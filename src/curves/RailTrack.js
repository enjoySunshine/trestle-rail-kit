/**
 * @author       Richard Davey <rich@phaser.io>
 * @copyright    2013-2026 Phaser Studio Inc.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

var Class = require('../utils/Class');
var QuadraticBezierInterpolation = require('../math/interpolation/QuadraticBezierInterpolation');
var Vector2 = require('../math/Vector2');

/**
 * @classdesc
 * A RailTrack is a Path-like curve that is sampled by traveled distance instead of by
 * normalized position. It is intended for rail vehicles, camera rails and any other
 * object that moves "distance per frame" rather than "fraction per tween".
 *
 * A RailTrack can be either open or closed:
 *
 * - An open track stops at its final point. Any distance beyond the total length resolves
 *   to the end point, and any negative distance resolves to the start point.
 * - A closed track wraps. A distance of exactly one full length resolves to the start
 *   point, so a vehicle crossing the finish line reappears at the entrance.
 *
 * Every segment is a straight line or a quadratic Bézier curve. Lengths are measured with
 * the same arc-length table used by Phaser's Curve and Path classes (100 subdivisions per
 * curved segment by default), so the numbers returned here line up with `Phaser.Curves.Path`.
 *
 * The track also exposes an *observation* point, which is a second sample placed a fixed
 * distance ahead of the vehicle. It is measured along the track using the same open /
 * closed rules as the vehicle, which means the observation point can be on a different
 * segment than the vehicle - or even back at the start of a closed track.
 *
 * @class RailTrack
 * @memberof Phaser.Curves
 * @constructor
 * @since 4.3.0
 *
 * @param {Phaser.Types.Curves.RailTrackConfig} [config] - Configuration options for the track.
 */
var RailTrack = new Class({

    initialize:

    function RailTrack (config)
    {
        if (config === undefined) { config = {}; }

        /**
         * Is this track closed? A closed track wraps distances; an open track clamps them.
         *
         * @name Phaser.Curves.RailTrack#closed
         * @type {boolean}
         * @default false
         * @since 4.3.0
         */
        this.closed = config.closed === true;

        /**
         * The number of arc-length subdivisions used for each curved segment.
         *
         * @name Phaser.Curves.RailTrack#arcLengthDivisions
         * @type {number}
         * @default 100
         * @since 4.3.0
         */
        this.arcLengthDivisions = config.arcLengthDivisions || 100;

        /**
         * The default distance ahead of the vehicle at which the observation point is placed.
         *
         * @name Phaser.Curves.RailTrack#lookAhead
         * @type {number}
         * @default 0
         * @since 4.3.0
         */
        this.lookAhead = config.lookAhead || 0;

        /**
         * The starting point of the track.
         *
         * @name Phaser.Curves.RailTrack#startPoint
         * @type {Phaser.Math.Vector2}
         * @since 4.3.0
         */
        this.startPoint = new Vector2(
            config.x === undefined ? 0 : config.x,
            config.y === undefined ? 0 : config.y
        );

        /**
         * The segments that make up this track.
         *
         * @name Phaser.Curves.RailTrack#segments
         * @type {Phaser.Curves.RailTrackSegment[]}
         * @since 4.3.0
         */
        this.segments = [];

        /**
         * Cached cumulative segment lengths.
         *
         * @name Phaser.Curves.RailTrack#cacheLengths
         * @type {number[]}
         * @private
         * @since 4.3.0
         */
        this.cacheLengths = [];

        /**
         * The cached total length.
         *
         * @name Phaser.Curves.RailTrack#_length
         * @type {number}
         * @private
         * @since 4.3.0
         */
        this._length = 0;
    },

    /**
     * Appends a straight line segment from the current end of the track to the given point.
     *
     * @method Phaser.Curves.RailTrack#lineTo
     * @since 4.3.0
     *
     * @param {number} x - The X coordinate of the line's end point.
     * @param {number} y - The Y coordinate of the line's end point.
     *
     * @return {this} This RailTrack object.
     */
    lineTo: function (x, y)
    {
        this.segments.push(new RailLineSegment(this.getEndPoint(), new Vector2(x, y)));

        this.updateArcLengths();

        return this;
    },

    /**
     * Appends a quadratic Bézier segment from the current end of the track, using the given
     * control point and end point.
     *
     * The parameter order matches `Phaser.Curves.Path#quadraticBezierTo`: the end point comes
     * first, followed by the control point.
     *
     * @method Phaser.Curves.RailTrack#quadraticBezierTo
     * @since 4.3.0
     *
     * @param {number} x - The X coordinate of the end point.
     * @param {number} y - The Y coordinate of the end point.
     * @param {number} controlX - The X coordinate of the control point.
     * @param {number} controlY - The Y coordinate of the control point.
     *
     * @return {this} This RailTrack object.
     */
    quadraticBezierTo: function (x, y, controlX, controlY)
    {
        this.segments.push(new RailQuadraticSegment(
            this.getEndPoint(),
            new Vector2(controlX, controlY),
            new Vector2(x, y),
            this.arcLengthDivisions
        ));

        this.updateArcLengths();

        return this;
    },

    /**
     * Returns the ending point of the track.
     *
     * @method Phaser.Curves.RailTrack#getEndPoint
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The ending point.
     */
    getEndPoint: function (out)
    {
        if (out === undefined) { out = new Vector2(); }

        if (this.segments.length === 0)
        {
            return out.copy(this.startPoint);
        }

        return this.segments[this.segments.length - 1].getPoint(1, out);
    },

    /**
     * Returns the starting point of the track.
     *
     * @method Phaser.Curves.RailTrack#getStartPoint
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The starting point.
     */
    getStartPoint: function (out)
    {
        if (out === undefined) { out = new Vector2(); }

        return out.copy(this.startPoint);
    },

    /**
     * Returns an array containing the total track length at the end of each segment.
     *
     * @method Phaser.Curves.RailTrack#getCurveLengths
     * @since 4.3.0
     *
     * @return {number[]} The cumulative lengths.
     */
    getCurveLengths: function ()
    {
        if (this.cacheLengths.length === this.segments.length + 1)
        {
            return this.cacheLengths;
        }

        var lengths = [ 0 ];
        var sum = 0;

        for (var i = 0; i < this.segments.length; i++)
        {
            sum += this.segments[i].getLength();

            lengths.push(sum);
        }

        this.cacheLengths = lengths;
        this._length = sum;

        return lengths;
    },

    /**
     * Returns the total arc length of the track.
     *
     * @method Phaser.Curves.RailTrack#getLength
     * @since 4.3.0
     *
     * @return {number} The total length, in pixels.
     */
    getLength: function ()
    {
        this.getCurveLengths();

        return this._length;
    },

    /**
     * Clears the cached arc lengths and recalculates them.
     *
     * @method Phaser.Curves.RailTrack#updateArcLengths
     * @since 4.3.0
     *
     * @return {this} This RailTrack object.
     */
    updateArcLengths: function ()
    {
        this.cacheLengths = [];
        this._length = 0;

        this.getCurveLengths();

        return this;
    },

    /**
     * Returns the segment that contains the given normalized position, and the local
     * `u` value within that segment.
     *
     * @method Phaser.Curves.RailTrack#getSegmentAt
     * @since 4.3.0
     *
     * @param {number} t - The normalized position, between 0 and 1.
     *
     * @return {?object} An object with `segment` and `u` properties, or `null` if the position is out of range.
     */
    getSegmentAt: function (t)
    {
        if (t < 0 || t > 1)
        {
            return null;
        }

        var curveLengths = this.getCurveLengths();
        var d = t * this._length;

        for (var i = 0; i < this.segments.length; i++)
        {
            if (curveLengths[i + 1] >= d)
            {
                var segment = this.segments[i];
                var segmentLength = segment.getLength();
                var diff = curveLengths[i + 1] - d;
                var u = (segmentLength === 0) ? 0 : 1 - diff / segmentLength;

                return { segment: segment, u: u };
            }
        }

        return null;
    },

    /**
     * Returns the point at a normalized position on the track.
     *
     * This is the "sample by normalized position" view: it does not wrap. At `t = 1` the
     * geometric end of the track is returned, even on a closed track, and the heading is the
     * heading of the final segment.
     *
     * @method Phaser.Curves.RailTrack#getPoint
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {number} t - The normalized position, between 0 and 1.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {?Phaser.Math.Vector2} The point, or `null` if `t` is out of range.
     */
    getPoint: function (t, out)
    {
        if (out === undefined) { out = new Vector2(); }

        var location = this.getSegmentAt(t);

        if (!location)
        {
            return null;
        }

        return location.segment.getPointAt(location.u, out);
    },

    /**
     * Returns the unit tangent (heading) at a normalized position on the track.
     *
     * Like `getPoint`, this does not wrap. At `t = 1` the final segment's heading is returned.
     *
     * @method Phaser.Curves.RailTrack#getTangent
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {number} t - The normalized position, between 0 and 1.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {?Phaser.Math.Vector2} The unit tangent, or `null` if `t` is out of range.
     */
    getTangent: function (t, out)
    {
        if (out === undefined) { out = new Vector2(); }

        var location = this.getSegmentAt(t);

        if (!location)
        {
            return null;
        }

        return location.segment.getTangentAt(location.u, out);
    },

    /**
     * Maps a traveled distance onto the track.
     *
     * A closed track wraps the distance into `[0, length)`, so a whole lap resolves to 0.
     * An open track clamps the distance to `[0, length]`.
     *
     * @method Phaser.Curves.RailTrack#resolveDistance
     * @since 4.3.0
     *
     * @param {number} distance - The raw traveled distance.
     *
     * @return {number} The resolved distance.
     */
    resolveDistance: function (distance)
    {
        var length = this.getLength();

        if (length === 0)
        {
            return 0;
        }

        if (this.closed)
        {
            var wrapped = distance % length;

            if (wrapped < 0)
            {
                wrapped += length;
            }

            if (wrapped >= length)
            {
                wrapped = 0;
            }

            return wrapped;
        }

        if (distance < 0)
        {
            return 0;
        }

        if (distance > length)
        {
            return length;
        }

        return distance;
    },

    /**
     * Returns the point at a traveled distance along the track.
     *
     * @method Phaser.Curves.RailTrack#getPointAtDistance
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {number} distance - The distance traveled from the start of the track.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The point at the resolved distance.
     */
    getPointAtDistance: function (distance, out)
    {
        if (out === undefined) { out = new Vector2(); }

        var length = this.getLength();
        var resolved = this.resolveDistance(distance);

        if (length === 0)
        {
            return out.copy(this.startPoint);
        }

        return this.getPoint(resolved / length, out);
    },

    /**
     * Returns the unit tangent (heading) at a traveled distance along the track.
     *
     * @method Phaser.Curves.RailTrack#getTangentAtDistance
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {number} distance - The distance traveled from the start of the track.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The unit tangent at the resolved distance.
     */
    getTangentAtDistance: function (distance, out)
    {
        if (out === undefined) { out = new Vector2(); }

        var length = this.getLength();
        var resolved = this.resolveDistance(distance);

        if (length === 0)
        {
            return out.set(1, 0);
        }

        return this.getTangent(resolved / length, out);
    },

    /**
     * Returns the state of the vehicle at a traveled distance.
     *
     * The returned object contains the resolved distance, the point and the heading (unit
     * tangent) at that point.
     *
     * @method Phaser.Curves.RailTrack#getCarState
     * @since 4.3.0
     *
     * @param {number} distance - The distance traveled from the start of the track.
     *
     * @return {object} An object with `distance`, `point` and `tangent` properties.
     */
    getCarState: function (distance)
    {
        var resolved = this.resolveDistance(distance);

        return {
            distance: resolved,
            point: this.getPointAtDistance(distance),
            tangent: this.getTangentAtDistance(distance)
        };
    },

    /**
     * Returns the observation state at a fixed distance ahead of the vehicle.
     *
     * The observation distance is resolved with the same open / closed rules as the vehicle.
     * On a closed track it wraps past the finish line and back onto the first segment. On an
     * open track it stops at the final point.
     *
     * @method Phaser.Curves.RailTrack#getObservation
     * @since 4.3.0
     *
     * @param {number} distance - The vehicle's traveled distance.
     * @param {number} [lead] - The distance ahead of the vehicle. Defaults to the track's `lookAhead` value.
     *
     * @return {object} An object with `distance`, `point` and `tangent` properties.
     */
    getObservation: function (distance, lead)
    {
        if (lead === undefined) { lead = this.lookAhead; }

        var resolved = this.resolveDistance(distance + lead);

        return {
            distance: resolved,
            point: this.getPointAtDistance(distance + lead),
            tangent: this.getTangentAtDistance(distance + lead)
        };
    },

    /**
     * Returns only the observation point at a fixed distance ahead of the vehicle.
     *
     * @method Phaser.Curves.RailTrack#getObservationPoint
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {number} distance - The vehicle's traveled distance.
     * @param {number} [lead] - The distance ahead of the vehicle. Defaults to the track's `lookAhead` value.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The observation point.
     */
    getObservationPoint: function (distance, lead, out)
    {
        if (lead === undefined) { lead = this.lookAhead; }
        if (out === undefined) { out = new Vector2(); }

        return this.getPointAtDistance(distance + lead, out);
    },

    /**
     * Returns only the observation heading at a fixed distance ahead of the vehicle.
     *
     * @method Phaser.Curves.RailTrack#getObservationTangent
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {number} distance - The vehicle's traveled distance.
     * @param {number} [lead] - The distance ahead of the vehicle. Defaults to the track's `lookAhead` value.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The observation tangent.
     */
    getObservationTangent: function (distance, lead, out)
    {
        if (lead === undefined) { lead = this.lookAhead; }
        if (out === undefined) { out = new Vector2(); }

        return this.getTangentAtDistance(distance + lead, out);
    },

    /**
     * Returns a sequence of evenly spaced points along the track, by normalized position.
     *
     * @method Phaser.Curves.RailTrack#getPoints
     * @since 4.3.0
     *
     * @param {number} [divisions=100] - The number of divisions to make.
     *
     * @return {Phaser.Math.Vector2[]} The points along the track.
     */
    getPoints: function (divisions)
    {
        if (divisions === undefined) { divisions = 100; }

        var points = [];

        for (var i = 0; i <= divisions; i++)
        {
            points.push(this.getPoint(i / divisions));
        }

        return points;
    },

    /**
     * Draws the track to a Graphics Game Object.
     *
     * @method Phaser.Curves.RailTrack#draw
     * @since 4.3.0
     *
     * @generic {Phaser.GameObjects.Graphics} G - [out,$return]
     *
     * @param {Phaser.GameObjects.Graphics} graphics - The Graphics object to draw to.
     * @param {number} [pointsTotal=32] - The number of points to use for each segment.
     *
     * @return {Phaser.GameObjects.Graphics} The Graphics object that was drawn to.
     */
    draw: function (graphics, pointsTotal)
    {
        if (pointsTotal === undefined) { pointsTotal = 32; }

        graphics.strokePoints(this.getPoints(pointsTotal * this.segments.length));

        return graphics;
    },

    /**
     * Converts the track to a JSON object.
     *
     * @method Phaser.Curves.RailTrack#toJSON
     * @since 4.3.0
     *
     * @return {object} The JSON representation of this track.
     */
    toJSON: function ()
    {
        var segments = [];

        for (var i = 0; i < this.segments.length; i++)
        {
            segments.push(this.segments[i].toJSON());
        }

        return {
            type: 'RailTrack',
            x: this.startPoint.x,
            y: this.startPoint.y,
            closed: this.closed,
            lookAhead: this.lookAhead,
            arcLengthDivisions: this.arcLengthDivisions,
            segments: segments
        };
    },

    /**
     * Destroys this track, clearing its segment data.
     *
     * @method Phaser.Curves.RailTrack#destroy
     * @since 4.3.0
     */
    destroy: function ()
    {
        this.segments.length = 0;
        this.cacheLengths.length = 0;
        this.startPoint = undefined;
    }

});

/**
 * A straight segment of a RailTrack.
 *
 * @class Phaser.Curves.RailLineSegment
 * @constructor
 * @since 4.3.0
 *
 * @param {Phaser.Math.Vector2} p0 - The start point.
 * @param {Phaser.Math.Vector2} p1 - The end point.
 */
var RailLineSegment = new Class({

    initialize:

    function RailLineSegment (p0, p1)
    {
        this.p0 = p0.clone();
        this.p1 = p1.clone();
        this._lengths = null;
    },

    /**
     * Returns a point at a normalized position along the segment.
     *
     * @method Phaser.Curves.RailLineSegment#getPoint
     * @since 4.3.0
     *
     * @param {number} t - The normalized position, between 0 and 1.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The point.
     */
    getPoint: function (t, out)
    {
        if (out === undefined) { out = new Vector2(); }

        if (t === 1)
        {
            return out.copy(this.p1);
        }

        return out.set(
            this.p0.x + (this.p1.x - this.p0.x) * t,
            this.p0.y + (this.p1.y - this.p0.y) * t
        );
    },

    /**
     * Returns the cumulative arc lengths of this segment.
     *
     * @method Phaser.Curves.RailLineSegment#getLengths
     * @since 4.3.0
     *
     * @return {number[]} The cumulative lengths.
     */
    getLengths: function ()
    {
        if (!this._lengths)
        {
            var length = this.p0.distance(this.p1);

            this._lengths = [ 0, length ];
        }

        return this._lengths;
    },

    /**
     * Returns the length of this segment.
     *
     * @method Phaser.Curves.RailLineSegment#getLength
     * @since 4.3.0
     *
     * @return {number} The length.
     */
    getLength: function ()
    {
        var lengths = this.getLengths();

        return lengths[lengths.length - 1];
    },

    /**
     * Returns a point at a normalized arc-length position along the segment.
     *
     * @method Phaser.Curves.RailLineSegment#getPointAt
     * @since 4.3.0
     *
     * @param {number} u - The normalized position, between 0 and 1.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The point.
     */
    getPointAt: function (u, out)
    {
        return this.getPoint(u, out);
    },

    /**
     * Returns the unit tangent of this segment.
     *
     * @method Phaser.Curves.RailLineSegment#getTangentAt
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {number} [u] - Unused, as a line has a constant tangent.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The unit tangent.
     */
    getTangentAt: function (u, out)
    {
        if (out === undefined) { out = new Vector2(); }

        return out.copy(this.p1).subtract(this.p0).normalize();
    },

    /**
     * Converts this segment to JSON.
     *
     * @method Phaser.Curves.RailLineSegment#toJSON
     * @since 4.3.0
     *
     * @return {object} The JSON representation of this segment.
     */
    toJSON: function ()
    {
        return {
            type: 'line',
            points: [ this.p0.x, this.p0.y, this.p1.x, this.p1.y ]
        };
    }

});

/**
 * A quadratic Bézier segment of a RailTrack.
 *
 * @class Phaser.Curves.RailQuadraticSegment
 * @constructor
 * @since 4.3.0
 *
 * @param {Phaser.Math.Vector2} p0 - The start point.
 * @param {Phaser.Math.Vector2} p1 - The control point.
 * @param {Phaser.Math.Vector2} p2 - The end point.
 * @param {number} divisions - The number of arc-length subdivisions.
 */
var RailQuadraticSegment = new Class({

    initialize:

    function RailQuadraticSegment (p0, p1, p2, divisions)
    {
        this.p0 = p0.clone();
        this.p1 = p1.clone();
        this.p2 = p2.clone();
        this.divisions = divisions || 100;
        this._lengths = null;
    },

    /**
     * Returns a point at a normalized position along the segment.
     *
     * @method Phaser.Curves.RailQuadraticSegment#getPoint
     * @since 4.3.0
     *
     * @param {number} t - The normalized position, between 0 and 1.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The point.
     */
    getPoint: function (t, out)
    {
        if (out === undefined) { out = new Vector2(); }

        return out.set(
            QuadraticBezierInterpolation(t, this.p0.x, this.p1.x, this.p2.x),
            QuadraticBezierInterpolation(t, this.p0.y, this.p1.y, this.p2.y)
        );
    },

    /**
     * Returns the cumulative arc lengths of this segment.
     *
     * @method Phaser.Curves.RailQuadraticSegment#getLengths
     * @since 4.3.0
     *
     * @return {number[]} The cumulative lengths.
     */
    getLengths: function ()
    {
        if (this._lengths)
        {
            return this._lengths;
        }

        var divisions = this.divisions;
        var cache = [ 0 ];
        var last = this.getPoint(0);
        var sum = 0;

        for (var i = 1; i <= divisions; i++)
        {
            var current = this.getPoint(i / divisions);

            sum += current.distance(last);

            cache.push(sum);

            last = current;
        }

        this._lengths = cache;

        return cache;
    },

    /**
     * Returns the length of this segment.
     *
     * @method Phaser.Curves.RailQuadraticSegment#getLength
     * @since 4.3.0
     *
     * @return {number} The length.
     */
    getLength: function ()
    {
        var lengths = this.getLengths();

        return lengths[lengths.length - 1];
    },

    /**
     * Maps a normalized arc-length position to the segment's raw `t` value.
     *
     * @method Phaser.Curves.RailQuadraticSegment#getUtoT
     * @since 4.3.0
     *
     * @param {number} u - The normalized arc-length position, between 0 and 1.
     *
     * @return {number} The raw curve parameter.
     */
    getUtoT: function (u)
    {
        var arcLengths = this.getLengths();
        var il = arcLengths.length;
        var targetArcLength = u * arcLengths[il - 1];

        var low = 0;
        var high = il - 1;
        var i = 0;
        var comparison;

        while (low <= high)
        {
            i = Math.floor(low + (high - low) / 2);

            comparison = arcLengths[i] - targetArcLength;

            if (comparison < 0)
            {
                low = i + 1;
            }
            else if (comparison > 0)
            {
                high = i - 1;
            }
            else
            {
                high = i;
                break;
            }
        }

        i = high;

        if (arcLengths[i] === targetArcLength)
        {
            return i / (il - 1);
        }

        var lengthBefore = arcLengths[i];
        var lengthAfter = arcLengths[i + 1];
        var segmentLength = lengthAfter - lengthBefore;
        var segmentFraction = (targetArcLength - lengthBefore) / segmentLength;

        return (i + segmentFraction) / (il - 1);
    },

    /**
     * Returns a point at a normalized arc-length position along the segment.
     *
     * @method Phaser.Curves.RailQuadraticSegment#getPointAt
     * @since 4.3.0
     *
     * @param {number} u - The normalized arc-length position, between 0 and 1.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The point.
     */
    getPointAt: function (u, out)
    {
        return this.getPoint(this.getUtoT(u), out);
    },

    /**
     * Returns the unit tangent at a normalized arc-length position along the segment.
     *
     * @method Phaser.Curves.RailQuadraticSegment#getTangentAt
     * @since 4.3.0
     *
     * @generic {Phaser.Math.Vector2} O - [out,$return]
     *
     * @param {number} u - The normalized arc-length position, between 0 and 1.
     * @param {Phaser.Math.Vector2} [out] - An optional Vector2 to store the result in.
     *
     * @return {Phaser.Math.Vector2} The unit tangent.
     */
    getTangentAt: function (u, out)
    {
        if (out === undefined) { out = new Vector2(); }

        var t = this.getUtoT(u);
        var delta = 0.0001;
        var t1 = t - delta;
        var t2 = t + delta;

        if (t1 < 0) { t1 = 0; }
        if (t2 > 1) { t2 = 1; }

        var a = this.getPoint(t1);
        var b = this.getPoint(t2);

        return out.set(b.x - a.x, b.y - a.y).normalize();
    },

    /**
     * Converts this segment to JSON.
     *
     * @method Phaser.Curves.RailQuadraticSegment#toJSON
     * @since 4.3.0
     *
     * @return {object} The JSON representation of this segment.
     */
    toJSON: function ()
    {
        return {
            type: 'quadratic',
            points: [
                this.p0.x, this.p0.y,
                this.p1.x, this.p1.y,
                this.p2.x, this.p2.y
            ]
        };
    }

});

module.exports = RailTrack;
