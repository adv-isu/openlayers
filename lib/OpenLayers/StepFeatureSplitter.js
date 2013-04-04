/* Copyright (c) 2006-2012 by OpenLayers Contributors (see authors.txt for
 * full list of contributors). Published under the 2-clause BSD license.
 * See license.txt in the OpenLayers distribution or repository for the
 * full text of the license. */

/**
 * @requires OpenLayers/BaseTypes/Class.js
 */

/**
 * Class: OpenLayers.StepFeatureSplitter
 */
OpenLayers.StepFeatureSplitter = OpenLayers.Class({

    sourceFeature: null,

    sourceGeometry: null,

    sourceBounds: null,

    jstsSource: null,

    sourceEnv: null,

    complete: false,

    eventListeners: null,

    events: null,

    parser: null,

    canceled: false,

    targetFeature: null,

    target: null,

    targetParts: null,

    jstsTarget: null,

    boundary: null,

    factory: null,

    multiLineString: null,

    prelimJstsPolys: null,

    finalJstsPolys: null,

    jstsPolygons: null,

    numJstsPolygons: 0,

    jstsPolygonIndex: 0,

    resultPolygons: null,

    stage: 0,

    initialize: function(sourceFeature, jstsSource,
      targetFeature, parser, options) {
      if (sourceFeature != null) {
        this.sourceFeature = sourceFeature;
        this.sourceGeometry = sourceFeature.geometry;
        this.sourceBounds = sourceFeature.geometry.getBounds();
      }
      if (jstsSource != null) {
        this.jstsSource = jstsSource;
        this.sourceEnv = jstsSource.getEnvelopeInternal();
      }
      this.targetParts = [];
      this.prelimJstsPolys = [];
      this.finalJstsPolys = [];
      this.jstsPolygons = [];
      this.resultPolygons = [];
      if (targetFeature != null) {
        this.targetFeature = targetFeature;
        this.target = targetFeature.geometry;
        this.targetParts.push(this.target);
      }
      this.parser = parser || new jsts.io.OpenLayersParser();
      OpenLayers.Util.extend(this, options);
      this.events = new OpenLayers.Events(this);
      if(this.eventListeners instanceof Object) {
          this.events.on(this.eventListeners);
      }
    },

    run: function() {
      while (this.step()) {
        // do nothing!
      }
    },

    cancel: function() {
      this.canceled = true;
    },

    step: function() {
      var keepGoing = false;
      if (this.canceled) {
        return false;
      }
      switch (this.stage) {
        case OpenLayers.StepFeatureSplitter.STAGE_UNION_LINESTRINGS:
          keepGoing = this.unionLineStrings();
          this.fractionDone = .25;
          break;
        case OpenLayers.StepFeatureSplitter.STAGE_POLYGONIZE:
          keepGoing = this.polygonize();
          this.fractionDone = .5;
          break;
        case OpenLayers.StepFeatureSplitter.STAGE_FIND_KEEPERS:
          keepGoing = this.findKeepers();
          var ratio = 1;
          if (this.numJstsPolygons > 0) {
            ratio = this.jstsPolygonIndex / this.numJstsPolygons;
          }
          this.fractionDone = .5 + (.25 * ratio);
          break;
        case OpenLayers.StepFeatureSplitter.STAGE_MERGE:
          keepGoing = this.merge();
          this.fractionDone = .75;
          break;
        case OpenLayers.StepFeatureSplitter.STAGE_CONVERT:
          keepGoing = this.convert();
          var ratio2 = 1;
          this.fractionDone = .75 + (.25 * ratio2);
          break;
      }
      if (keepGoing) {
        this.events.triggerEvent("progress", {fractionDone: this.fractionDone});
      }
      else {
        this.complete = true;
        this.events.triggerEvent("complete");
      }
      return keepGoing;
    },

    unionLineStrings: function() {
      if(!this.sourceBounds.intersectsBounds(this.target.getBounds())) {
        return false;
      }
      this.jstsTarget = this.parser.read(this.target);

      this.boundary = this.jstsTarget.getBoundary();
      this.factory = this.boundary.getFactory();

      if(this.boundary instanceof jsts.geom.LineString){
        this.multiLineString = new jsts.geom.MultiLineString(
        [this.boundary], this.factory);
      }
      else if(this.boundary instanceof jsts.geom.MultiLineString){
        this.multiLineString = this.boundary;
      }
      if(this.multiLineString == null) {
        return false;
      }
      this.multiLineString = this.multiLineString.union(this.jstsSource);
      this.stage = OpenLayers.StepFeatureSplitter.STAGE_POLYGONIZE;
      return true;
    },

    polygonize: function() {
        var polygonizer = new jsts.operation.polygonize.Polygonizer();
        polygonizer.add(this.multiLineString);
        this.jstsPolygons = polygonizer.getPolygons();
        this.numJstsPolygons = this.jstsPolygons.size();
        // I had to remove this optimization because it broke merges.
        // It's important to use the newly-created polygons even when
        // a feature isn't actually split, because the newly-created polygons
        // are properly noded.  That is, if an adjacent feature has been split,
        // there will be a new vertex on this feature's edge at the point
        // where the other feature was split.  This ensures that the edges
        // of the new polygons are still 100% coincident with the adjacent
        // edge of this feature.
//        if (this.numJstsPolygons === 1) {
//          return false;
//        }
//        else {
          this.stage = OpenLayers.StepFeatureSplitter.STAGE_FIND_KEEPERS;
          return true;
//        }
    },
    
    isFeatureVisible: function() {
        var feature = this.targetFeature;
        return !!feature && (!feature.style || feature.style.display !== "none");
    },

    findKeepers: function() {
      if (this.jstsPolygonIndex >= this.numJstsPolygons) {
        if (!this.isFeatureVisible()) {
            this.stage = OpenLayers.StepFeatureSplitter.STAGE_MERGE;
        }
        else {
            this.stage = OpenLayers.StepFeatureSplitter.STAGE_CONVERT;
        }
      }
      else {
          var p2 = this.jstsPolygons.get(this.jstsPolygonIndex++);
          var p2env = p2.getEnvelopeInternal();

          if(this.sourceEnv.intersects(p2env)){
            var coords = [];
            coords.push(new jsts.geom.Coordinate(p2env.getMinX(), p2env.getMinY()),
                        new jsts.geom.Coordinate(p2env.getMinX(), p2env.getMaxY()),
                        new jsts.geom.Coordinate(p2env.getMaxX(), p2env.getMaxY()),
                        new jsts.geom.Coordinate(p2env.getMaxX(), p2env.getMinY()),
                        new jsts.geom.Coordinate(p2env.getMinX(), p2env.getMinY()));
            var p2envGeom = new jsts.geom.Polygon(
              new jsts.geom.LinearRing(coords, this.factory), null, this.factory);
            var intersection = new jsts.geom.Geometry(this.factory);
            var contains = false;
            try {
              contains = this.jstsTarget.contains(p2envGeom);
            }
            catch (cerr) {
              // contains() threw an exception, but it was just
              // a speed optimization anyway.  Leave contains
              // set to false and we'll do a more complete check
              // with the intersection down below.
              //log("caught cerr = " + cerr);
            }
            if (contains) {
              intersection = p2;
            }
            else {
              try {
                intersection = p2.intersection(this.jstsTarget);
              }
              catch (ierr) {
                log("caught ierr = " + ierr);
                try {
                    intersection = this.jstsTarget.intersection(p2);
                }
                catch (ierr2) {
                    log("caught ierr2 = " + ierr2);
                    intersection = p2;
                }
              }
            }
            // If more of the generated polygon is inside the target feature
            // than outside of it, we have a keeper.  This test is just here
            // to throw out polygons that are outside the target feature.
            if(intersection instanceof jsts.geom.Polygon &&
                intersection.getArea() > p2.getArea() / 2.0) {
              // Note: do NOT use "intersection" here, as it will introduce
              // tiny slivers between polygons that will keep them from merging
              // properly.
              this.prelimJstsPolys.push(p2);
            }
          }
        }
        return true;
    },
    
    merge: function() {
        var prelimJstsPolys = this.prelimJstsPolys;
        var len = prelimJstsPolys.length;
        if (len == 1) {
            this.stage = OpenLayers.StepFeatureSplitter.STAGE_CONVERT;
        }
        else {
            prelimJstsPolys[0] = prelimJstsPolys[0].union(prelimJstsPolys[len - 1]);
            prelimJstsPolys.length--;
        }
        return true;
    },

    convert: function() {
      var prelimJstsPolys = this.prelimJstsPolys;
      var finalJstsPolys = this.finalJstsPolys;
      var resultPolygons = this.resultPolygons;
      var parser = this.parser;
      
      for (var ppi = 0, pplen = prelimJstsPolys.length; ppi < pplen; ppi++) {
        var p = prelimJstsPolys[ppi];
        var g = p; // GeometryProcessor.ProcessGeometry( p, getMinimumFeatureSize() );
        var polys = this.getPolygons( g, 0 );
        for (var polyi = 0, polylen = polys.length; polyi < polylen; polyi++) {
          var polyToAdd = polys[polyi];
          if (!polyToAdd.isValid()) {
            var tmpgeom = jstsUtil.splitAndUnionBowtie(polyToAdd, 0);
            var tmppolys = this.getPolygons(tmpgeom, 0);
            for (var k = 0, klen = tmppolys.length; k < klen; k++) {
              finalJstsPolys.push(tmppolys[k]);
            }
          }
          else {
            if(polyToAdd.isValid() && polyToAdd.getArea() > 0){
              finalJstsPolys.push(polyToAdd); //JtsUtil.CopyPolygon(polyToAdd));
            }
          }
        }
      }

      for (var ji = 0, jlen = finalJstsPolys.length; ji < jlen; ji++){
        resultPolygons.push(parser.write(finalJstsPolys[ji]));
      }

      //resultPolygons = source.split(target, options);
      //Removed the "&& result.parts.length > 1" optimization because it
      // screws up merges.  More on this at a later date...
//      if(resultPolygons.length > 1) {
        this.targetParts = resultPolygons;
//      }
      return false;
    },

    getPolygons: function(g, minPolygonSize) {
      var polys = [];
      if(g instanceof jsts.geom.GeometryCollection){
        for(var i = 0, len = g.getNumGeometries(); i < len; i++){
          var tmp = g.getGeometryN(i);
          if(tmp instanceof jsts.geom.Polygon){
            // Add only if the area is greater than 100th of an acre
            if (tmp.getArea() > minPolygonSize) {
              polys.push(tmp);
            }
          }
        }
      }
      else if (g instanceof jsts.geom.Polygon) {
        if (g.getArea() > minPolygonSize) {
          polys.push(g);
        }
      }
      return polys;
    },

    destroy: function() {
        if(this.events) {
            if(this.eventListeners) {
                this.events.un(this.eventListeners);
            }
            this.events.destroy();
            this.events = null;
        }
        this.eventListeners = null;
    },

    CLASS_NAME: "OpenLayers.StepFeatureSplitter"
});

OpenLayers.StepFeatureSplitter.STAGE_UNION_LINESTRINGS = 0;
OpenLayers.StepFeatureSplitter.STAGE_POLYGONIZE = 1;
OpenLayers.StepFeatureSplitter.STAGE_FIND_KEEPERS = 2;
OpenLayers.StepFeatureSplitter.STAGE_MERGE = 3;
OpenLayers.StepFeatureSplitter.STAGE_CONVERT = 4;
