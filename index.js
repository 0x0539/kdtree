var ShapeSet = function () {
    this.shapes = {};
    this.length = 0;
};

ShapeSet.prototype.add = function (shape) {
    if (!(shape.id in this.shapes)) {
        this.shapes[shape.id] = shape;
        this.length++;
        return true;
    }
    return false;
};

ShapeSet.prototype.remove = function (shape) {
    if (shape.id in this.shapes) {
        delete this.shapes[shape.id];
        this.length--;
        return true;
    }
    return false;
};

ShapeSet.prototype.has = function (shape) {
    return shape.id in this.shapes;
}

var Partition = function (dimension, shapeAry, shapeSet) {
    this.dimension = dimension;

    this.shapeSet = shapeSet;
    this.shapeAry = shapeAry;
    this.lShapeSet = new ShapeSet();
    this.rShapeSet = new ShapeSet();

    // Explicitly declaring fields without initial values.
    this.split = null;
    this.score = null;
};

Partition.prototype.getLShapeAry = function (splitDimension) {
    return splitDimension ? new Ary(this.shapeAry.array, this.shapeAry.aryL, this.split) : this.shapeAry;
};

Partition.prototype.getRShapeAry = function (splitDimension) {
    return splitDimension ? new Ary(this.shapeAry.array, this.split, this.shapeAry.aryR) : this.shapeAry;
};

Partition.prototype.update = function () {
    var lastShape = null,
        prior = null,
        score = null,
        split = null,
        // Rightmost point of all shapes seen so far.
        F = null,
        // Number of shapes to the left if we were to split before the current shape.
        L = 0,
        // Number of shapes to the right if we were to split before the current shape.
        R = this.shapeSet.length;

    // Get bounds of iteration, some subarray of this.shapeAry.
    var i1 = this.shapeAry.getAryL(),
        i2 = this.shapeAry.getAryR();

    for (var i = i1; i < i2; i++) {
        var shape = this.shapeAry.array[i];

        // Check that the current shape is actually part of this partition.
        if (this.shapeSet.has(shape)) {
            var s = shape.coords[this.dimension][0],
                f = shape.coords[this.dimension][1];

            // Split before the current shape only if the current shape
            // is completely to the right of previous shapes.
            if (F != null && s > F) {
                var nextScore = L * L + R * R;
                if (score == null || nextScore < score) {
                    // Split between lastShape and i.
                    prior = lastShape;
                    split = i;
                    score = nextScore;
                } else {
                    // Stop because scores will only increase from here.
                    break;
                }
            }

            L++;
            R--;

            if (F == null || f > F) {
                F = f;
                lastShape = i;
            }
        }
    }

    this.prior = prior;
    this.split = split;
    this.score = score;
    this.dirty = false;

    // Mark the dirty bit if no valid split exists.
    if (this.score == null)
        this.dirty = true;

    if (this.split != null) {
        // Get the physical location of the split.
        var splitLocation = this.shapeAry.array[this.split].coords[this.dimension][0];

        // For each shape in the partition, either add to the left shape set or the right shape set.        
        for (var id in this.shapeSet.shapes) {
            var shape = this.shapeSet.shapes[id],
                s = shape.coords[this.dimension][0];

            // Compare physical location relative to the split.
            if (s < splitLocation) {
                if (this.lShapeSet.add(shape)) this.dirty = true;
                if (this.rShapeSet.remove(shape)) this.dirty = true;
            } else {
                if (this.rShapeSet.add(shape)) this.dirty = true;
                if (this.lShapeSet.remove(shape)) this.dirty = true;
            }
        }
    }
};

var makeId = (function () {
    var nextId = 0;
    return function () {
        return nextId++;
    };
}());

var Shape = function () {
    this.coords = [];
    for (var i = 0; i < arguments.length; i += 2)
        this.coords.push([arguments[i], arguments[i + 1]])
    this.id = makeId();
};

Shape.prototype.overlaps = function (otherShape) {
    for (var i = 0; i < this.coords.length; i++) {
        var coords1 = this.coords[i],
            coords2 = otherShape.coords[i];
        if (coords1[0] > coords2[1] || coords1[1] < coords2[0])
            return false;
    }
    return true;
};

var Ary = function (array, aryL, aryR) {
    this.array = array;
    this.aryL = aryL;
    this.aryR = aryR;
};

Ary.prototype.getAryL = function () {
    return this.aryL;
};

Ary.prototype.getAryR = function () {
    return this.aryR == null ? this.array.length : this.aryR;
};

var Tree = function (shapeArys, shapeSet) {
    this.dimensions = shapeArys.length;
    this.partitions = [];
    for (var i = 0; i < shapeArys.length; i++)
        this.partitions.push(new Partition(i, shapeArys[i], shapeSet));
    this.shapeSet = shapeSet;
    this.step = null;
};

Tree.prototype.query = function (queryShape, resultSet, step) {
    if (this.step != step) {
        this.update();
        this.step = step;
    }
    if (this.partition == null) {
        for (var shapeId in this.shapeSet.shapes) {
            var shape = this.shapeSet.shapes[shapeId];
            if (queryShape.overlaps(shape)) {
                resultSet.add(shape);
            }
        }
    } else {
        var splitDimension = this.partition.dimension,
            lBoundingShape = this.partition.shapeAry.array[this.partition.prior],
            rBoundingShape = this.partition.shapeAry.array[this.partition.split],
            lBoundary = lBoundingShape.coords[splitDimension][1],
            rBoundary = rBoundingShape.coords[splitDimension][0];

        if (queryShape.coords[splitDimension][0] < lBoundary) {
            this.lTree.query(queryShape, resultSet, step);
        }

        if (queryShape.coords[splitDimension][1] > rBoundary) {
            this.rTree.query(queryShape, resultSet, step);
        }
    }
    return resultSet;
};

Tree.prototype.update = function () {
    if (this.partition != null) {
        this.partition.update();
        // Keep current partition because it hasn't changed.
        if (!this.partition.dirty)
            return;
    }

    // Update partitions in case of new elements/reorderings.
    for (var i = 0; i < this.partitions.length; i++)
        if (this.partitions[i] != this.partition)
            this.partitions[i].update();

    if (this.partition == null || this.partition.dirty) {
        var bestPartition = this.getBestPartition();

        if (bestPartition == null) {
            delete this.partition;
            delete this.lTree;
            delete this.rTree;
        } else {
            this.partition = bestPartition;

            var lShapeArys = [];
            var rShapeArys = [];

            for (var i = 0; i < this.partitions.length; i++) {
                lShapeArys.push(this.partitions[i].getLShapeAry(i == this.partition.dimension));
                rShapeArys.push(this.partitions[i].getRShapeAry(i == this.partition.dimension));
            }

            this.lTree = new Tree(lShapeArys, this.partition.lShapeSet);
            this.rTree = new Tree(rShapeArys, this.partition.rShapeSet);
        }
    }
};

Tree.prototype.getBestPartition = function () {
    var best = null
    for (var i = 0; i < this.partitions.length; i++) {
        if (this.partitions[i] == null || this.partitions[i].score == null)
            continue;
        if (best == null || this.partitions[i].score < best.score)
            best = this.partitions[i];
    }
    return best;
};

var Index = function (dimensions) {
    this.dimensions = dimensions;
    this.shapeArys = [];
    for (var i = 0; i < dimensions; i++)
        this.shapeArys.push(new Ary([], 0, null));
    this.shapeSet = new ShapeSet();
    this.tree = new Tree(this.shapeArys, this.shapeSet);
    this.step = 0;
};

Index.prototype.add = function (shape) {
    if (shape.coords.length != this.dimensions)
        throw new Error("shape has the wrong number of dimensions");
    for (var i = 0; i < this.shapeArys.length; i++)
        this.shapeArys[i].array.push(shape);
    this.shapeSet.add(shape);
};

Index.prototype.update = function () {
    for (var i = 0; i < this.shapeArys.length; i++)
        this.sort(this.shapeArys[i].array, i);
    this.step++;
};

Index.prototype.query = function (shape) {
    if (shape.coords.length != this.dimensions)
        throw new Error("query shape has the wrong number of dimensions");
    return this.tree.query(shape, new ShapeSet(), this.step);
};

Index.prototype.sort = function (ary, dim) {
    for (var i = 1; i < ary.length; i++) {
        var iShape = ary[i],
            Si = iShape.coords[dim][0];
        for (var j = i - 1; j >= 0; j--) {
            var jShape = ary[j],
                Sj = jShape.coords[dim][0];
            if (Si >= Sj)
                break;
            var temp = ary[j];
            ary[j] = ary[j + 1];
            ary[j + 1] = temp;
        }
    }
};

exports.Index = Index;
exports.BoundingBox = Shape;
