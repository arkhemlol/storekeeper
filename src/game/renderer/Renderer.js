import Tween from '@tweenjs/tween.js';

import {
  LEVEL_MAP_ITEM_WORKER,
  LEVEL_MAP_ITEM_GOAL,
  LEVEL_MAP_ITEM_BOX,
  EVENT_LEVEL_MOVE_END
} from '../../constants';

import Worker from '../level/object/Worker';
import Wall from '../level/object/Wall';
import Goal from '../level/object/Goal';
import Box from '../level/object/Box';

class Renderer {
  _container = null;
  _canvas = null;
  _level = null;
  _camera = null;

  constructor(options = {}) {
    if (this.constructor === Renderer) {
      throw new Error('Can\'t construct abstract renderer.');
    }

    const { container } = options;
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('Container must be HTML element.');
    }

    this._container = container;
    this._canvas = document.createElement('canvas');
    this._container.appendChild(this._canvas);

    this.onWindowResize = this.onWindowResize.bind(this);
    this.onMoveEnd = this.onMoveEnd.bind(this);

    this._camera = {
      tween: null,
      offset: { x: 0, y: 0 }
    };

    window.addEventListener('resize', this.onWindowResize);
    this.adjustCanvasSize();
  }

  destroy() {
    window.removeEventListener('resize', this.onWindowResize);
    if (this.level) {
      this.removeLevelListeners(this.level);
    }
  }

  addLevelListeners(level) {
    level.on(EVENT_LEVEL_MOVE_END, this.onMoveEnd);
  }

  removeLevelListeners(level) {
    level.off(EVENT_LEVEL_MOVE_END, this.onMoveEnd);
  }

  onWindowResize() {
    this.adjustCanvasSize();
    this.adjustCamera({ smooth: true, interrupt: true });
  }

  onMoveEnd() {
    this.adjustCamera({ smooth: true, interrupt: false, delay: 50 });
  }

  render(time) {
    const context = this._canvas.getContext('2d');
    context.clearRect(0, 0, this.width, this.height);

    if (this.level === null) {
      return;
    }

    const { walls, goals, boxes, worker } = this.level;
    walls.forEach(wall => this.renderItem(wall));
    goals.forEach(goal => this.renderItem(goal));
    boxes.forEach(box => this.renderItem(box));
    this.renderItem(worker);

    Tween.update(time);
  }

  renderItem(item) {
    const context = this._canvas.getContext('2d');

    const x = this.getItemOffsetX(item);
    const y = this.getItemOffsetY(item);

    switch (item.constructor) {
      case Worker: {
        if (this.level.at(item.row, item.column, [LEVEL_MAP_ITEM_GOAL]).length === 1) {
          this.renderWorkerOverGoal(context, x, y, item);
        }
        else {
          this.renderWorker(context, x, y, item);
        }
        break;
      }

      case Wall: {
        this.renderWall(context, x, y, item);
        break;
      }

      case Goal: {
        const items = this.level.at(item.row, item.column, [LEVEL_MAP_ITEM_WORKER, LEVEL_MAP_ITEM_BOX]);
        if (items.length === 1) {
          if (items[0] instanceof Worker) {
            this.renderGoalBehindWorker(context, x, y, item);
          }
          else {
            this.renderGoalBehindBox(context, x, y, item);
          }
        }
        else {
          this.renderGoal(context, x, y, item);
        }
        break;
      }

      case Box: {
        if (this.level.at(item.row, item.column, [LEVEL_MAP_ITEM_GOAL]).length === 1) {
          this.renderBoxOverGoal(context, x, y, item);
        }
        else {
          this.renderBox(context, x, y, item);
        }
        break;
      }
    }
  }

  getItemOffsetX(item) {
    return this._camera.offset.x + item.column * this.itemWidth;
  }

  getItemOffsetY(item) {
    return this._camera.offset.y + item.row * this.itemHeight;
  }

  adjustCanvasSize() {
    this._canvas.width = this._container.offsetWidth;
    this._canvas.height = this._container.offsetHeight;
  }

  adjustCamera(options = {}) {
    const { interrupt = false } = options;
    if (this._camera.tween) {
      if (!interrupt) {
        return;
      }
      this._camera.tween.stop();
      this._camera.tween = null;
    }

    // If the whole level can't be placed within the canvas
    // we will move the camera to grant worker is visible at each moment of time
    const offsetX = this.calculateCameraOffsetX(),
      offsetY = this.calculateCameraOffsetY();

    // Checking whether camera's calculated position differs from the current one
    if (this._camera.offset.x === offsetX && this._camera.offset.y === offsetY) {
      return;
    }

    const { smooth = false } = options;
    if (!smooth) {
      this._camera.offset.x = offsetX;
      this._camera.offset.y = offsetY;
      return;
    }

    const { delay = 500, duration = 300 } = options;

    const tween = this._camera.tween = new Tween.Tween(this._camera.offset);
    tween.delay(delay).easing(Tween.Easing.Quadratic.In).to({
      x: offsetX,
      y: offsetY
    }, duration).onComplete(() => {
      this._camera.tween = null;
    }).start();
  }

  calculateCameraOffsetX() {
    let isVisibleX = true;
    let offsetX = Math.round((this.width - this.levelWidth) / 2);

    if (this.levelWidth > this.width) {
      // Calculating left point of the worker relative to the canvas
      const x = this.getItemOffsetX(this.level.worker);

      // Checking whether worker is within visible rectangle
      // that is 5/8 of the canvas and placed in the center of the canvas
      let visibleRectLeft = Math.round(this.width * 3 / 16);
      let visibleRectRight = this.width - Math.round(this.width * 3 / 16);

      if (this._camera.offset.x === this.width - this.levelWidth) {
        visibleRectRight = this.width;
      }
      else if (this._camera.offset.x === 0) {
        visibleRectLeft = 0;
      }

      isVisibleX = x >= visibleRectLeft && x + this.itemWidth <= visibleRectRight;

      if (!isVisibleX) {
        // We have to recalculate camera's left position to place the worker in the center
        const workerCanvasCenterX = Math.round((this.width - this.itemWidth) / 2);
        offsetX = this._camera.offset.x + workerCanvasCenterX - x;
      }
      else {
        offsetX = this._camera.offset.x;
      }

      if (offsetX > 0) {
        offsetX = 0;
      }
      else if (offsetX < this.width - this.levelWidth) {
        offsetX = this.width - this.levelWidth;
      }
    }

    return offsetX;
  }

  calculateCameraOffsetY() {
    let isVisibleY = true;
    let offsetY = Math.round((this.height - this.levelHeight) / 2);

    if (this.levelHeight > this.height) {
      // Calculating top point of the worker relative to the canvas
      const y = this.getItemOffsetY(this.level.worker);

      // Checking whether worker is within visible rectangle
      // that is 5/8 of the canvas and placed in the center of the canvas
      let visibleRectTop = Math.round(this.height * 3 / 16);
      let visibleRectBottom = this.height - Math.round(this.height * 3 / 16);

      if (this._camera.offset.y === this.height - this.levelHeight) {
        visibleRectBottom = this.height;
      }
      else if (this._camera.offset.y === 0) {
        visibleRectTop = 0;
      }

      isVisibleY = y >= visibleRectTop && y + this.itemHeight <= visibleRectBottom;

      if (!isVisibleY) {
        // We have to recalculate camera's top position to place the worker in the center
        const workerCanvasCenterY = Math.round((this.height - this.itemHeight) / 2);
        offsetY = this._camera.offset.y + workerCanvasCenterY - y;
      }
      else {
        offsetY = this._camera.offset.y;
      }

      if (offsetY > 0) {
        offsetY = 0;
      }
      else if (offsetY < this.height - this.levelHeight) {
        offsetY = this.height - this.levelHeight;
      }
    }

    return offsetY;
  }

  get level() {
    return this._level;
  }

  set level(level) {
    if (this._level) {
      this.removeLevelListeners(this._level);
    }

    this._level = level;
    this.addLevelListeners(level);

    this.adjustCamera({ smooth: false, interrupt: true });
  }

  get width() {
    return this._canvas.width;
  }

  get height() {
    return this._canvas.height;
  }

  get levelWidth() {
    return this.level ? this.level.columnsCount * this.itemWidth : 0;
  }

  get levelHeight() {
    return this.level ? this.level.rowsCount * this.itemHeight : 0;
  }

  get itemWidth() {
    return 8;
  }

  get itemHeight() {
    return 8;
  }

  renderWorker(context, x, y, item) { // eslint-disable-line no-unused-vars
    throw new Error('Method "renderWorker" is not implemented.');
  }

  renderWorkerOverGoal(context, x, y, item) { // eslint-disable-line no-unused-vars
    throw new Error('Method "renderWorkerOverGoal" is not implemented.');
  }

  renderWall(context, x, y, item) { // eslint-disable-line no-unused-vars
    throw new Error('Method "renderWall" is not implemented.');
  }

  renderGoal(context, x, y, item) { // eslint-disable-line no-unused-vars
    throw new Error('Method "renderGoal" is not implemented.');
  }

  renderGoalBehindWorker(context, x, y, item) { // eslint-disable-line no-unused-vars
    throw new Error('Method "renderGoalBehindWorker" is not implemented.');
  }

  renderGoalBehindBox(context, x, y, item) { // eslint-disable-line no-unused-vars
    throw new Error('Method "renderGoalBehindBox" is not implemented.');
  }

  renderBox(context, x, y, item) { // eslint-disable-line no-unused-vars
    throw new Error('Method "renderBox" is not implemented.');
  }

  renderBoxOverGoal(context, x, y, item) { // eslint-disable-line no-unused-vars
    throw new Error('Method "renderBoxOverGoal" is not implemented.');
  }
}

export default Renderer;
