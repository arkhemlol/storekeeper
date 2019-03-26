'use strict';

import _ from 'underscore';
import Backbone from 'backbone';

import Direction from './Direction';
import LevelMap from './LevelMap';

import Worker from './object/Worker';
import Wall from './object/Wall';
import Goal from './object/Goal';
import Box from './object/Box';

class Level {
  constructor(items, options) {
    if (items instanceof LevelMap) {
      this.map = items;
    }
    else {
      this.map = new LevelMap(items);
    }

    if (!this.map.validate()) {
      throw new Error('Level map is invalid.');
    }

    options = options || {};
    this.stepsPerMove = options.stepsPerMove || 16;

    this.reset();
  }

  reset() {
    this._worker = null;
    this._walls = [];
    this._goals = [];
    this._boxes = [];

    for (let row = 0; row < this.map.rows; row++) {
      for (let column = 0; column < this.map.columns; column++) {
        const item = this.map.at(row, column);
        if (LevelMap.isWorkerItem(item)) {
          this._worker = new Worker(row, column);
        }
        if (LevelMap.isWallItem(item)) {
          this._walls.push(new Wall(row, column));
        }
        if (LevelMap.isGoalItem(item)) {
          this._goals.push(new Goal(row, column));
        }
        if (LevelMap.isBoxItem(item)) {
          this._boxes.push(new Box(row, column));
        }
      }
    }

    this._direction = Direction.NONE;

    this._isAnimating = false;
    this._animatedItems = [];

    this._boxesOverGoalsCount = null;
    this._isCompletedTriggered = false;
  }

  at(row, column, filter) {
    const items = [];

    if (!filter) {
      filter = ['worker', 'walls', 'goals', 'boxes'];
    }

    _.each(filter, filterType => {
      switch (filterType) {
        case 'wall': filterType = 'walls'; break;
        case 'goal': filterType = 'goals'; break;
        case 'box': filterType = 'boxes'; break;
      }

      if (filterType === 'worker' && this._worker.row === row && this._worker.column === column) {
        items.push(this._worker);
      }
      else {
        _.each(this['_' + filterType], item => {
          if (item.row === row && item.column === column) {
            items.push(item);
            return false;
          }
          return true;
        });
      }
    });

    return items;
  }

  isOutOfBounds(row, column) {
    return row < 0 || row >= this.rows || column < 0 || column >= this.columns;
  }

  isCompleted() {
    return this.boxesOverGoalsCount === this.boxesCount;
  }

  move() {
    const animatedBox = this.getAnimatedBox();

    if (this._isAnimating) {
      if (this.animate()) {
        this._isAnimating = false;

        if (animatedBox !== null) {
          this._boxesOverGoalsCount = null;
        }

        this.trigger('move:end', {
          boxesCount: this.boxesCount,
          boxesOverGoalsCount: this.boxesOverGoalsCount
        });
      }
      return false;
    }

    if (this.isCompleted()) {
      if (!this._isCompletedTriggered) {
        this._isCompletedTriggered = true;
        this.trigger('completed');
      }
      return false;
    }

    // Drop goal target flag for recenlty animated box
    if (animatedBox !== null) {
      animatedBox.goalSource = animatedBox.goalTarget;
      animatedBox.goalTarget = false;
    }

    const shift = Direction.getShift(this._direction);
    if (shift.x === 0 && shift.y === 0) {
      this.resetAnimatedItems();
      return false;
    }

    const isCollision = this.detectCollision(shift);
    if (isCollision) {
      this.resetAnimatedItems();
      if (Direction.isValidHorizontal(this._direction)) {
        this.worker.lastHorizontalDirection = this._direction;
      }
      return false;
    }

    this._isAnimating = true;
    _.each(this._animatedItems, item => {
      item.move(this._direction, this.stepSize);
    });

    this.trigger('move:start', {
      movesCount: this.movesCount,
      pushesCount: this.pushesCount
    });

    if (this.animate()) {
      this._isAnimating = false;
    }

    return true;
  }

  getAnimatedBox() {
    const box = _.find(this._animatedItems, item => {
      return item instanceof Box;
    });
    return box ? box : null;
  }

  detectCollision(shift) {
    const targetRow = this.worker.row + shift.y,
      targetColumn = this.worker.column + shift.x;

    if (this.isOutOfBounds(targetRow, targetColumn)) {
      return false;
    }

    let targetItems = this.at(targetRow, targetColumn),
      targetBox = null,
      targetGoal = null,
      isCollision = false;

    _.each(targetItems, targetItem => {
      if (targetItem instanceof Wall) {
        isCollision = true;
        return false;
      }

      if (targetItem instanceof Box) {
        targetBox = targetItem;

        const boxTargetRow = targetItem.row + shift.y,
          boxTargetColumn = targetItem.column + shift.x;

        if (this.isOutOfBounds(boxTargetRow, boxTargetColumn)) {
          isCollision = true;
        }
        else {
          const boxTargetItems = this.at(boxTargetRow, boxTargetColumn);
          _.each(boxTargetItems, boxTargetItem => {
            if (boxTargetItem instanceof Wall || boxTargetItem instanceof Box) {
              isCollision = true;
            }
            else {
              targetBox.goalTarget = boxTargetItem instanceof Goal;
            }
          });
        }
      }
      else if (targetItem instanceof Goal) {
        targetGoal = targetItem;
      }
    });

    if (!isCollision) {
      this._animatedItems = [this.worker];
      if (targetBox !== null) {
        this._animatedItems.push(targetBox);
        if (targetGoal !== null) {
          targetBox.goalSource = true;
        }
      }
    }

    return isCollision;
  }

  animate() {
    let isAnimated = false;
    _.each(this._animatedItems, item => {
      isAnimated = item.animate();
    });
    return isAnimated;
  }

  resetAnimatedItems() {
    _.each(this._animatedItems, item => {
      item.reset();
    });
    this._animatedItems = [];
  }

  /**
     * @returns {LevelMap}
     */
  get map() {
    return this._map;
  }

  /**
     * @param {LevelMap} map
     */
  set map(map) {
    this._map = map;
  }

  get rows() {
    return this._map.rows;
  }

  get columns() {
    return this._map.columns;
  }

  get stepsPerMove() {
    return this._stepsPerMove;
  }

  set stepsPerMove(stepsPerMove) {
    this._stepsPerMove = stepsPerMove;
  }

  get stepSize() {
    return 1 / this._stepsPerMove;
  }

  get direction() {
    return this._direction;
  }

  set direction(moveDirection) {
    if (Direction.isValid(moveDirection)) {
      this._direction = moveDirection;
    }
  }

  get worker() {
    return this._worker;
  }

  get walls() {
    return this._walls;
  }

  get goals() {
    return this._goals;
  }

  get boxes() {
    return this._boxes;
  }

  get boxesCount() {
    return this._boxes.length;
  }

  get goalsCount() {
    return this._goals.length;
  }

  get boxesOverGoalsCount() {
    if (this._boxesOverGoalsCount !== null) {
      return this._boxesOverGoalsCount;
    }

    this._boxesOverGoalsCount = 0;
    _.each(this._boxes, box => {
      const goals = this.at(box.row, box.column, ['goal']);
      if (goals.length === 1) {
        this._boxesOverGoalsCount++;
      }
    });
    return this._boxesOverGoalsCount;
  }

  get movesCount() {
    return this.worker.movesCount;
  }

  get pushesCount() {
    let count = 0;
    _.each(this.boxes, box => {
      count += box.movesCount;
    });
    return count;
  }

  toString() {
    return this.map.toString();
  }
}

_.extend(Level.prototype, Backbone.Events);

export default Level;
