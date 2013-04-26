kdtree
======

Node.js KDTree implementation with lazy indexing for sparse object collision detection. See [this fiddle](http://jsfiddle.net/0x0539/vShP4/12/embedded/result/) for a running example.

This KDTree implementation indexes axis-aligned bounding boxes (AABB's) in any number of dimensions. It is meant to do real-time indexing with many updates per second (think collision detection of sparse objects like bullets in a fast-paced game). This implementation really benefits from object stability meaning that the less your objects move, the faster index updates will be. For rapidly moving objects (like objects that teleport across the space every timestep), this is a poor choice of index.

The index is actually computed at query time, which is what is meant by 'lazy indexing'. And only the necessary parts are computed. So if you think that you will only be computing collisions in a few small parts of the space at each timestep, this will be an especially efficient choice of index.

You can use the index via the exposed `BoundingBox` and `Index` types in a compositional style:

```
var kdtree = require('lazykdtree');

var UnitCircle = function () {
  this.centerX = 0;
  this.centerY = 0;
  this.boundingBox = new kdtree.BoundingBox();
  this.updateBoundingBox();
};

UnitCircle.prototype.move = function (dx, dy) {
  this.centerX += dx;
  this.centerY += dy;
  this.updateBoundingBox();
};

UnitCircle.prototype.updateBoundingBox = function () {
  // Update the bounding box coordinates.
  this.boundingBox.coords = [
    [this.centerX - 1, this.centerX + 1], 
    [this.centerY - 1, this.centerY + 1]
  ];
};

// Construct a 2d index.
var index = new kdtree.Index(2);

// Create a UnitCircle and add bounding box to the index.
var circle = new UnitCircle();
index.add(circle.boundingBox);

// Recompute the bounding box with each move to cause index recomputation.
index.update();
circle.move(-2, 3);
index.update();
circle.move(1, 2);
index.update();

// Returns a ShapeSet that contains the BoundingBoxes that overlap the input box.
index.query(new kdtree.BoundingBox([[-1, 1], [-1, 1]]));
```
