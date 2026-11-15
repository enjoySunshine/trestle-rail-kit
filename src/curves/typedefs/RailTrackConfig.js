/**
 * @author       Richard Davey <rich@phaser.io>
 * @copyright    2013-2026 Phaser Studio Inc.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

/**
 * @typedef {object} Phaser.Types.Curves.RailTrackConfig
 *
 * @property {number} [x=0] - The x coordinate of the track's starting point.
 * @property {number} [y=0] - The y coordinate of the track's starting point.
 * @property {boolean} [closed=false] - Should the track wrap when the vehicle travels past its total length? A closed track returns to its starting point; an open track stops at its end point.
 * @property {number} [lookAhead=0] - The default distance ahead of the vehicle at which the observation point is placed.
 * @property {number} [arcLengthDivisions=100] - The number of arc length subdivisions used for each curved segment.
 */
