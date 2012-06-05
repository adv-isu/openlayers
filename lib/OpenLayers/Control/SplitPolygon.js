/* Copyright (c) 2006-2012 by OpenLayers Contributors (see authors.txt for 
 * full list of contributors). Published under the Clear BSD license.  
 * See http://svn.openlayers.org/trunk/openlayers/license.txt for the
 * full text of the license. */

/**
 * @requires OpenLayers/Control.js
 * @requires OpenLayers/Handler/Path.js
 * @requires OpenLayers/Layer/Vector.js
 */

/**
 * Class: OpenLayers.Control.SplitPolygon
 * Acts as a split feature agent while editing vector features.
 *
 * Inherits from:
 *  - <OpenLayers.Control>
 */
OpenLayers.Control.SplitPolygon = OpenLayers.Class(OpenLayers.Control, {

    /** 
     * APIProperty: events
     * {<OpenLayers.Events>} Events instance for listeners and triggering
     *     control specific events.
     *
     * Register a listener for a particular event with the following syntax:
     * (code)
     * control.events.register(type, obj, listener);
     * (end)
     *
     * Supported event types (in addition to those from <OpenLayers.Control.events>):
     * beforesplit - Triggered before a split occurs.  Listeners receive an
     *     event object with *source* and *target* properties.
     * split - Triggered when a split occurs.  Listeners receive an event with
     *     an *original* property and a *features* property.  The original
     *     is a reference to the target feature that the sketch or modified
     *     feature intersects.  The features property is a list of all features
     *     that result from this single split.  This event is triggered before
     *     the resulting features are added to the layer (while the layer still
     *     has a reference to the original).
     * aftersplit - Triggered after all splits resulting from a single sketch
     *     or feature modification have occurred.  The original features
     *     have been destroyed and features that result from the split
     *     have already been added to the layer.  Listeners receive an event
     *     with a *source* and *features* property.  The source references the
     *     sketch or modified feature used as a splitter.  The features
     *     property is a list of all resulting features.
     */
    
    /**
     * APIProperty: layer
     * {<OpenLayers.Layer.Vector>} The target layer with features to be split.
     *     Set at construction or after construction with <setLayer>.
     */
    layer: null,
    
    /**
     * Property: source
     * {<OpenLayers.Layer.Vector>} Optional source layer.  Any newly created
     *     or modified features from this layer will be used to split features
     *     on the target layer.  If not provided, a temporary sketch layer will
     *     be created.
     */
    source: null,
    
    /**
     * Property: sourceOptions
     * {Options} If a temporary sketch layer is created, these layer options
     *     will be applied.
     */
    sourceOptions: null,

    /**
     * APIProperty: freehand
     * (boolean) Whether to turn freehand mode on by default.
     */
     freehand: false,
     
    /**
     * APIProperty: tolerance
     * {Number} Distance between the calculated intersection and a vertex on
     *     the source geometry below which the existing vertex will be used
     *     for the split.  Default is null.
     */
    tolerance: null,
    
    /**
     * APIProperty: edge
     * {Boolean} Allow splits given intersection of edges only.  Default is
     *     true.  If false, a vertex on the source must be within the
     *     <tolerance> distance of the calculated intersection for a split
     *     to occur.
     */
    edge: true,
    
    /**
     * APIProperty: deferDelete
     * {Boolean} Instead of removing features from the layer, set feature
     *     states of split features to DELETE.  This assumes a save strategy
     *     or other component is in charge of removing features from the
     *     layer.  Default is false.  If false, split features will be
     *     immediately deleted from the layer.
     */
    deferDelete: false,
    
    /**
     * APIProperty: mutual
     * {Boolean} If source and target layers are the same, split source
     *     features and target features where they intersect.  Default is
     *     true.  If false, only target features will be split.
     */
    mutual: true,
    
    /**
     * APIProperty: targetFilter
     * {<OpenLayers.Filter>} Optional filter that will be evaluated
     *     to determine if a feature from the target layer is eligible for
     *     splitting.
     */
    targetFilter: null,
    
    /**
     * APIProperty: sourceFilter
     * {<OpenLayers.Filter>} Optional filter that will be evaluated
     *     to determine if a feature from the source layer is eligible for
     *     splitting.
     */
    sourceFilter: null,
    
    /**
     * Property: handler
     * {<OpenLayers.Handler.Path>} The temporary sketch handler created if
     *     no source layer is provided.
     */
    handler: null,

    simplifyDistance: 0,

    nextId: 1,

    undoLink: null,

    cancelLink: null,

    linksDiv: null,

    /**
     * Constructor: OpenLayers.Control.SplitPolygon
     * Creates a new SplitPolygon control. A control is constructed with a target
     *     layer and an optional source layer. While the control is active,
     *     creating new features or modifying existing features on the source
     *     layer will result in splitting any eligible features on the target
     *     layer.  If no source layer is provided, a temporary sketch layer will
     *     be created to create lines for splitting features on the target.
     *
     * Parameters:
     * options - {Object} An object containing all configuration properties for
     *     the control.
     *
     * Valid options:
     * layer - {<OpenLayers.Layer.Vector>} The target layer.  Features from this
     *     layer will be split by new or modified features on the source layer
     *     or temporary sketch layer.
     * source - {<OpenLayers.Layer.Vector>} Optional source layer.  If provided
     *     newly created features or modified features will be used to split
     *     features on the target layer.  If not provided, a temporary sketch
     *     layer will be created for drawing lines.
     * tolerance - {Number} Optional value for the distance between a source
     *     vertex and the calculated intersection below which the split will
     *     occur at the vertex.
     * edge - {Boolean} Allow splits given intersection of edges only.  Default
     *     is true.  If false, a vertex on the source must be within the
     *     <tolerance> distance of the calculated intersection for a split
     *     to occur.
     * mutual - {Boolean} If source and target are the same, split source
     *     features and target features where they intersect.  Default is
     *     true.  If false, only target features will be split.
     * targetFilter - {<OpenLayers.Filter>} Optional filter that will be evaluated
     *     to determine if a feature from the target layer is eligible for
     *     splitting.
     * sourceFilter - {<OpenLayers.Filter>} Optional filter that will be evaluated
     *     to determine if a feature from the target layer is eligible for
     *     splitting.
     */
    initialize: function(options) {
        OpenLayers.Control.prototype.initialize.apply(this, [options]);
        this.options = options || {}; // TODO: this could be done by the super
        
        // set the source layer if provided
        if(this.options.source) {
            this.setSource(this.options.source);
        }
        this.linksDiv = document.createElement("div")
        this.undoLink = document.createElement("a");
        this.undoLink.setAttribute("href", "#");
        this.undoLink.appendChild(document.createTextNode("Undo Vertex"));
        OpenLayers.Element.addClass(this.undoLink, "olButton");
        this.cancelLink = document.createElement("a");
        this.cancelLink.setAttribute("href", "#");
        this.cancelLink.appendChild(document.createTextNode("Reset Split"));
        OpenLayers.Element.addClass(this.cancelLink, "olButton");
        this.linksDiv.appendChild(this.cancelLink);
        this.linksDiv.appendChild(this.undoLink);
    },

    draw: function (px) {
        var div = OpenLayers.Control.prototype.draw.apply(this),
        eventsInstance = this.map.events;
        eventsInstance.register("buttonclick", this, this.handleButtonClick);
        return div;
    },

    handleButtonClick: function(evt) {
      var button = evt.buttonElement;
      if (button === this.undoLink) {
        if (!!this.handler && !!this.handler.line &&
          !!this.handler.line.geometry) {
          this.handler.undo();
        }
      }
      else if (button === this.cancelLink) {
        if (!!this.handler && !!this.handler.line &&
          !!this.handler.line.geometry) {
          if (confirm("Clear the split line and start over?")) {
            this.handler.destroyFeature();
          }
        }
      }
    },
    
    /**
     * APIMethod: setSource
     * Set the source layer for edits layer.
     *
     * Parameters:
     * layer - {<OpenLayers.Layer.Vector>}  The new source layer layer.  If
     *     null, a temporary sketch layer will be created.
     */
    setSource: function(layer) {
        if(this.active) {
            this.deactivate();
            if(this.handler) {
                this.handler.destroy();
                delete this.handler;
            }
            this.source = layer;
            this.activate();
        } else {
            this.source = layer;
        }
    },
    
    /**
     * APIMethod: activate
     * Activate the control.  Activating the control registers listeners for
     *     editing related events so that during feature creation and
     *     modification, features in the target will be considered for
     *     splitting.
     */
    activate: function() {
        var activated = OpenLayers.Control.prototype.activate.call(this);
        if(activated) {
            if (!!this.div) {
              this.div.appendChild(this.linksDiv);
            }
            if(!this.source) {
                if(!this.handler) {
                    this.handler = new OpenLayers.Handler.Path(this,
                        {done: function(geometry) {
                            this.onSketchComplete({
                                feature: new OpenLayers.Feature.Vector(geometry)
                            });
                        }},
                        {freehand: this.freehand,
                         layerOptions: this.sourceOptions}
                    );
                }
                this.handler.activate();
            } else if(this.source.events) {
                this.source.events.on({
                    sketchcomplete: this.onSketchComplete,
                    afterfeaturemodified: this.afterFeatureModified,
                    scope: this
                });
            }
        }
        return activated;
    },
    
    /**
     * APIMethod: deactivate
     * Deactivate the control.  Deactivating the control unregisters listeners
     *     so feature editing may proceed without engaging the split agent.
     */
    deactivate: function() {
        var deactivated = OpenLayers.Control.prototype.deactivate.call(this);
        if(deactivated) {
            if (!!this.div) {
              this.div.removeChild(this.linksDiv);
            }
            if(this.source && this.source.events) {
                this.source.events.un({
                    sketchcomplete: this.onSketchComplete,
                    afterfeaturemodified: this.afterFeatureModified,
                    scope: this
                });
            }
        }
        return deactivated;
    },
    
    /**
     * Method: onSketchComplete
     * Registered as a listener for the sketchcomplete event on the editable
     *     layer.
     *
     * Parameters:
     * event - {Object} The sketch complete event.
     *
     * Returns:
     * {Boolean} Stop the sketch from being added to the layer (it has been
     *     split).
     */
    onSketchComplete: function(event) {
        this.feature = null;
        if (this.simplifyDistance >= 0 && event.feature.geometry.simplify) { // linestring
          try {
            event.feature.geometry = event.feature.geometry.simplify(this.simplifyDistance);
          }
          catch (err) {
            alert("Error simplifying splitter line: " + err);
          }
          //event.feature.redraw();
        }
//        try {
          return !this.considerSplit(event.feature);
//        }
//        catch (err2) {
//          alert("Error splitting: " + err2);
//          return false;
//        }
    },
    
    /**
     * Method: afterFeatureModified
     * Registered as a listener for the afterfeaturemodified event on the
     *     editable layer.
     *
     * Parameters:
     * event - {Object} The after feature modified event.
     */
    afterFeatureModified: function(event) {
//        if(event.modified) {
//            var feature = event.feature;
//            if (typeof feature.geometry.split === "function") {
//                this.feature = event.feature;
//                this.considerSplit(event.feature);
//            }
//        }
    },
    
    /**
     * Method: removeByGeometry
     * Remove a feature from a list based on the given geometry.
     *
     * Parameters:
     * features - {Array(<OpenLayers.Feature.Vector>)} A list of features.
     * geometry - {<OpenLayers.Geometry>} A geometry.
     */
    removeByGeometry: function(features, geometry) {
        for(var i=0, len=features.length; i<len; ++i) {
            if(features[i].geometry === geometry) {
                features.splice(i, 1);
                break;
            }
        }
    },
    
    /**
     * Method: isEligible
     * Test if a target feature is eligible for splitting.
     *
     * Parameters:
     * target - {<OpenLayers.Feature.Vector>} The target feature.
     *
     * Returns:
     * {Boolean} The target is eligible for splitting.
     */
    isEligible: function(target) {
        if (!target.geometry) {
            return false;
        } else {
            return (
                target.state !== OpenLayers.State.DELETE
            ) && (
                this.feature !== target
            ) && (
                this.isVisible(target)
            ) && (
                !this.targetFilter ||
                this.targetFilter.evaluate(target.attributes)
            );
        }
    },

    isVisible: function(feature) {
      return !!feature && (!feature.style || feature.style.display !== "none");
    },

    /**
     * Method: considerSplit
     * Decide whether or not to split target features with the supplied
     *     feature.  If <mutual> is true, both the source and target features
     *     will be split if eligible.
     *
     * Parameters:
     * feature - {<OpenLayers.Feature.Vector>} The newly created or modified
     *     feature.
     *
     * Returns:
     * {Boolean} The supplied feature was split (and destroyed).
     */
    considerSplit: function(feature) {
        var sourceSplit = false;
        var targetSplit = false;
        if(!this.sourceFilter ||
           this.sourceFilter.evaluate(feature.attributes)) {
            this.nextId = this.layer.getNextId();
            var features = this.layer && this.layer.features || [];
            var target, results, proceed;
            var additions = [], removals = [];
            var sourceParts = [feature.geometry];
            var targetFeature, targetParts;
            var source = feature.geometry;
            var sourceBounds = source.getBounds();
            var parser = new jsts.io.OpenLayersParser();
            var jstsSource = parser.read(source);
            var sourceEnv = jstsSource.getEnvelopeInternal();
            var sourceEnvGeom = jstsSource.getEnvelope();
            for(var i=0, len=features.length; i<len; ++i) {
                targetFeature = features[i];
                if(this.isEligible(targetFeature)) {
                    target = targetFeature.geometry;
                    targetParts = [targetFeature.geometry];

                    if(sourceBounds.intersectsBounds(target.getBounds())) {
                      var jstsTarget = parser.read(target);

                      var boundary = jstsTarget.getBoundary();
                      var fact = boundary.getFactory();
                      var multiLineString = null;
                      if(boundary instanceof jsts.geom.LineString){
                        multiLineString = new jsts.geom.MultiLineString(
                        [boundary], boundary.getFactory());
                      }
                      else if(boundary instanceof jsts.geom.MultiLineString){
                        multiLineString = boundary;
                      }
                      if(multiLineString == null) {
                        alert("continuing!");
                        continue;
                      }
                      multiLineString = multiLineString.union(jstsSource);

                      var polygonizer = new jsts.operation.polygonize.Polygonizer();
                      polygonizer.add(multiLineString);
                      var jstsPolygons = polygonizer.getPolygons();
                      var prelimPolys = [];
                      var finalPolys = [];

                      for(var jpi = 0, jplen = jstsPolygons.size(); jpi < jplen; jpi++){
                        var p2 = jstsPolygons.get(jpi);
                        var p2env = p2.getEnvelopeInternal();
                        
                        if(sourceEnv.intersects(p2env)){
                          var coords = [];
                          coords.push(new jsts.geom.Coordinate(p2env.getMinX(), p2env.getMinY()),
                                      new jsts.geom.Coordinate(p2env.getMinX(), p2env.getMaxY()),
                                      new jsts.geom.Coordinate(p2env.getMaxX(), p2env.getMaxY()),
                                      new jsts.geom.Coordinate(p2env.getMaxX(), p2env.getMinY()),
                                      new jsts.geom.Coordinate(p2env.getMinX(), p2env.getMinY()));
                          var p2envGeom = new jsts.geom.Polygon(
                            new jsts.geom.LinearRing(coords, fact), null, fact);
                          var intersection = new jsts.geom.Geometry(fact);
                          var contains = false;
                          try {
                            contains = jstsTarget.contains(p2envGeom);
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
                              intersection = p2.intersection(jstsTarget);
                            }
                            catch (ierr) {
                              //log("caught ierr = " + ierr);
  //                            console.log("");
  //                            console.log("ierr = " + ierr.toString());
  //                            console.log("target polygon:");
  //                            console.log(jstsTarget.toString());
  //                            console.log("generated polygon:");
  //                            console.log(p2.toString());
  //                            console.log("trying with parameters reversed");
                              try {
                                  intersection = jstsTarget.intersection(p2);
  //                              console.log("reversing parameters worked!");
                              }
                              catch (ierr2) {
                                  //log("caught ierr2 = " + ierr2);
  //                              console.log("");
  //                              console.log("ierr2 = " + ierr.toString());
                                  intersection = p2;
                              }
                            }
                          }
                          if(intersection instanceof jsts.geom.Polygon && intersection.getArea() > 0.00000001){
                            prelimPolys.push(intersection);
                          }
                        }
                      }
                      for (var ppi = 0, pplen = prelimPolys.length; ppi < pplen; ppi++) {
                        var p = prelimPolys[ppi];
                        var g = p; // GeometryProcessor.ProcessGeometry( p, getMinimumFeatureSize() );
                        var polys = getPolygons( g, 0 );
                        for (var polyi = 0, polylen = polys.length; polyi < polylen; polyi++){
                          var polyToAdd = polys[polyi];
                          if(polyToAdd.isValid() && polyToAdd.getArea() > 0){
                            finalPolys.push(polyToAdd); //JtsUtil.CopyPolygon(polyToAdd));
                          }
                        }
                      }

                      results = [];
                      for (var ji = 0, jlen = finalPolys.length; ji < jlen; ji++){
                        results.push(parser.write(finalPolys[ji]));
                      }


                        //results = source.split(target, options);
                        if(results.length > 1) {
                            proceed = this.events.triggerEvent(
                                "beforesplit", {source: feature, target: targetFeature}
                            );
                            if(proceed !== false) {
                              targetParts = results;
                            }
                        }
                    }
                    if(targetParts && targetParts.length > 1) {
                        this.geomsToFeatures(targetFeature, targetParts);
                        this.events.triggerEvent("split", {
                            original: targetFeature,
                            features: targetParts
                        });
                        Array.prototype.push.apply(additions, targetParts);
                        removals.push(targetFeature);
                        targetSplit = true;
                    }
                }
            }
            if(sourceParts && sourceParts.length > 1) {
                this.geomsToFeatures(feature, sourceParts);
                this.events.triggerEvent("split", {
                    original: feature,
                    features: sourceParts
                });
                Array.prototype.push.apply(additions, sourceParts);
                removals.push(feature);
                sourceSplit = true;
            }
            if(sourceSplit || targetSplit) {
                // remove and add feature events are suppressed
                // listen for split event on this control instead
                if(this.deferDelete) {
                    // Set state instead of removing.  Take care to avoid
                    // setting delete for features that have not yet been
                    // inserted - those should be destroyed immediately.
                    var feat, destroys = [];
                    for(var i=0, len=removals.length; i<len; ++i) {
                        feat = removals[i];
                        if(feat.state === OpenLayers.State.INSERT) {
                            destroys.push(feat);
                        } else {
                            feat.state = OpenLayers.State.DELETE;
                            this.layer.drawFeature(feat);
                        }
                    }
                    this.layer.destroyFeatures(destroys, {silent: true});
                    for(var i=0, len=additions.length; i<len; ++i) {
                        additions[i].state = OpenLayers.State.INSERT;
                    }
                } else {
                    this.layer.destroyFeatures(removals, {silent: true});
                }
                this.layer.addFeatures(additions, {silent: true});
                this.events.triggerEvent("aftersplit", {
                    source: feature,
                    features: additions
                });
            }
        }
        return sourceSplit;
    },
    
    /**
     * Method: geomsToFeatures
     * Create new features given a template feature and a list of geometries.
     *     The list of geometries is modified in place.  The result will be
     *     a list of new features.
     *
     * Parameters:
     * feature - {<OpenLayers.Feature.Vector>} The feature to be cloned.
     * geoms - {Array(<OpenLayers.Geometry>)} List of goemetries.  This will
     *     become a list of new features.
     */
    geomsToFeatures: function(feature, geoms) {
        var clone = feature.clone();
        delete clone.geometry;
        var newFeature;
        var biggestIndex = -1;
        if (geoms.length > 0) {
          for (var i = 0, len = geoms.length; i < len; i++) {
            var g = geoms[i];
            if (biggestIndex == -1 || g.getArea() > geoms[biggestIndex].getArea()) {
              biggestIndex = i;
            }
          }
          for(var i = 0, len = geoms.length; i < len; ++i) {
              // turn results list from geoms to features
              newFeature = clone.clone();
              newFeature.geometry = geoms[i];
              newFeature.attributes = JSON.parse(JSON.stringify(feature.attributes));
              if (i == biggestIndex) {
                newFeature.fid = feature.fid;
              }
              else {
                newFeature.fid = (this.nextId++).toString();
              }
              newFeature.state = OpenLayers.State.INSERT;
              geoms[i] = newFeature;
          }
          geoms.sort(function(a, b){
            var ida = parseInt(a.fid);
            var idb = parseInt(b.fid);
            if (ida > idb) {
              return 1;
            }
            else if (idb > ida) {
              return -1;
            }
            else {
              return 0;
            }
          });
        }
    },
    
    /**
     * Method: destroy
     * Clean up the control.
     */
    destroy: function() {
        if(this.active) {
            this.deactivate(); // TODO: this should be handled by the super
        }
        if (!!this.map) {
            this.map.events.unregister("buttonclick", this, this.handleButtonClick);
        }
        if (!!this.undoLink) {
          delete this.undoLink;
        }
        if (!!this.cancelLink) {
          delete this.cancelLink;
        }
        if (!!this.linksDiv) {
          delete this.linksDiv;
        }
        OpenLayers.Control.prototype.destroy.call(this);
    },

    CLASS_NAME: "OpenLayers.Control.SplitPolygon"
});
