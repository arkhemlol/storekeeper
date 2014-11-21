/**
 * @module Worker
 */
define([
    'lodash',
    './box',
    './movable',
    './wall',
    '../direction',
    '../../exception'
], function(
    _,
    Box,
    Movable,
    Wall,
    Direction,
    Level,
    Exception
) {
    'use strict';

    /**
     * @param {Object} options
     *
     * @author Dmitriy Pushkov <ezze@ezze.org>
     * @since 0.1.0
     * @alias module:Worker
     * @class
     * @augments module:Movable
     */
    var Worker = function(options) {
        Movable.apply(this, arguments);
        this._name = 'Worker';
        this.lookDirection = Direction.LEFT;
    };

    Worker.prototype = Object.create(Movable.prototype);

    Worker.prototype.move = function(direction) {
        Movable.prototype.move.apply(this, arguments);
    };

    Worker.prototype.detectCollision = function(direction) {
        if (Direction.isValidHorizontal(direction)) {
            this.lookDirection = direction;
        }

        var collision = {
            detected: false,
            target: null
        };

        var targetObjects = this.getMoveTargetObjects(direction);
        _.forEach(targetObjects, function(object) {
            if (object instanceof Wall) {
                // Wall doesn't allow the worker to move in any case
                collision = {
                    detected: true,
                    target: object
                };
                return false;
            }
            else if (object instanceof Box) {
                // Box can be pushed by the worker (and therefore allow him to move)
                // if there is no any object preventing its movement behind
                collision = {
                    detected: object.detectCollision(direction).detected,
                    target: object
                };
                return false;
            }
        });

        return collision;
    };

    Worker.prototype.startAnimation = function(direction) {
        switch (this.lookDirection) {
            case Direction.LEFT: this._sprite.gotoAndPlay('workerLeftWalk'); break;
            case Direction.RIGHT: this._sprite.gotoAndPlay('workerRightWalk'); break;
        }
    };

    Worker.prototype.stopAnimation = function() {
        switch (this.lookDirection) {
            case Direction.LEFT: this._sprite.gotoAndStop('workerLeftStand'); break;
            case Direction.RIGHT: this._sprite.gotoAndStop('workerRightStand'); break;
        }
    };

    Object.defineProperties(Worker.prototype, {
        lookDirection: {
            get: function() {
                return this._lookDirection;
            },
            set: function(lookDirection) {
                if (lookDirection === this._lookDirection) {
                    return;
                }

                if (!Direction.isValidHorizontal(lookDirection)) {
                    throw new Exception('Look direction is invalid.');
                }
                this._lookDirection = lookDirection;

                switch (this._lookDirection) {
                    case Direction.LEFT: this._sprite.gotoAndStop('workerLeftStand'); break;
                    case Direction.RIGHT: this._sprite.gotoAndStop('workerRightStand'); break;
                }
            }
        }
    });

    return Worker;
});