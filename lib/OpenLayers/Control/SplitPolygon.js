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
     * Property: handler
     * {<OpenLayers.Handler.Path>} The temporary sketch handler created if
     *     no source layer is provided.
     */
    handler: null,

    simplifyDistance: 0,

    nextId: 1,

    undoLink: null,

    cancelLink: null,
    
    commitLink: null,

    linksDiv: null,

    splitter: null,

    progressOverlay: null,

    updateTimerId: 0,

    /**
     * Constructor: OpenLayers.Control.Split
     * Creates a new split control. A control is constructed with a target
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
        this.commitLink = document.createElement("a");
        this.commitLink.setAttribute("href", "#");
        this.commitLink.appendChild(document.createTextNode("Finish Split"));
        OpenLayers.Element.addClass(this.commitLink, "olButton");
        this.cancelLink = document.createElement("a");
        this.cancelLink.setAttribute("href", "#");
        this.cancelLink.appendChild(document.createTextNode("Reset"));
        OpenLayers.Element.addClass(this.cancelLink, "olButton");
        this.linksDiv.appendChild(this.undoLink);
        this.linksDiv.appendChild(this.commitLink);
        this.linksDiv.appendChild(this.cancelLink);
    },

    draw: function (px) {
        var div = OpenLayers.Control.prototype.draw.apply(this, [px]),
        eventsInstance = this.map.events;
        eventsInstance.register("buttonclick", this, this.handleButtonClick);
        this.progressOverlay = new OpenLayers.ProgressOverlay(
          div.ownerDocument, "Split");
        this.progressOverlay.events.register("cancel", this, this.cancel);
        return div;
    },

    cancel: function() {
      if (this.splitter) {
        this.splitter.cancel();
      }
    },

    handleButtonClick: function(evt) {
      var button = evt.buttonElement;
      var scope = this;
      if (button === this.undoLink) {
        if (!!this.handler && !!this.handler.line &&
          !!this.handler.line.geometry) {
          this.handler.undo();
        }
      }
      else if (button === this.cancelLink) {
        // defer this to work around an iOS touch event bug that shows up when
        // you display a modal dialog in response to a click
        window.setTimeout(function(){scope.handleCancelClick()}, 0);
      }
      else if (button === this.commitLink) {
        // defer this to work around an iOS touch event bug that shows up when
        // you display a modal dialog in response to a click
        window.setTimeout(function(){scope.handleCommitLink()}, 0);
      }
    },
    
    handleCancelClick: function() {
      if (!!this.handler && !!this.handler.line &&
        !!this.handler.line.geometry) {
        if (confirm("Clear the split line and start over?")) {
          this.handler.destroyFeature();
        }
      }
    },
    
    handleCommitLink: function() {
      if (!!this.handler && !!this.handler.line &&
        !!this.handler.line.geometry) {
        if (confirm("Finish the split?")) {
          this.handler.finishGeometry();
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
        this.beginSplit(event.feature);
        return false;
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
                !this.targetFilter ||
                this.targetFilter.evaluate(target.attributes)
            );
        }
    },

    isVisible: function(feature) {
      return !!feature && (!feature.style || feature.style.display !== "none");
    },

    /**
     * Method: beginSplit
     * Begin the split.
     *
     * Parameters:
     * feature - {<OpenLayers.Feature.Vector>} The newly created or modified
     *     feature.
     *
     * Returns:
     * {Boolean} always false.
     */
    beginSplit: function(feature) {
        this.nextId = this.layer.getNextId();
        var features = this.layer && this.layer.features || [];
        var targetFeature = null;
        var targetFeatures = [];
        var bounds = feature.geometry.getBounds();

        this.progressOverlay.show();
        this.progressOverlay.update(0);
        
        for(var i=0, len=features.length; i<len; ++i) {
            targetFeature = features[i];
            if(this.isEligible(targetFeature) &&
              targetFeature.geometry.getBounds().intersectsBounds(bounds)) {
              targetFeatures.push(targetFeature);
            }
        }

        this.splitter = new OpenLayers.StepSplitter(feature, targetFeatures, {
          eventListeners: {
            "error": this.splitError,
            "progress": this.splitProgress,
            "complete": this.splitComplete,
            scope: this
          }
        });

        this.scheduleStep();
        
        return false;
    },

    scheduleStep: function() {
      var scope = this;
      window.setTimeout(function(){
        scope.splitter.step();
        if (!scope.splitter.complete) {
          scope.scheduleStep();
        }
        else {
          scope.splitter.destroy();
          scope.splitter = null;
        }
      }, 0);
    },

    splitError: function(evt) {
      this.progressOverlay.hide();
      alert("Couldn't complete the split!\n\n" + evt.error);
    },

    splitProgress: function(evt) {
      this.progressOverlay.update(evt.fractionDone);
    },

    splitComplete: function() {
      this.progressOverlay.hide();
      var splitter = this.splitter;
      var sourceFeature = splitter.sourceFeature;
      var splitResults = this.splitter.splitResults;
      var proceed = false;
      var additions = [];
      var removals = [];
      var targetSplit = false;
      for (var i = 0, len = splitResults.length; i < len; i++) {
        var result = splitResults[i];
        proceed = this.events.triggerEvent(
            "beforesplit", {source: sourceFeature, target: result.feature}
        );
        if (proceed !== false) {
          // Removed the "&& result.parts.length > 1" optimization because it
          // screws up merges.  More on this at a later date...
          if(result.parts /*&& result.parts.length > 1*/) {
              this.geomsToFeatures(result.feature, result.parts);
              this.events.triggerEvent("split", {
                  original: result.feature,
                  features: result.parts
              });
              Array.prototype.push.apply(additions, result.parts);
              removals.push(result.feature);
              targetSplit = true;
          }
        }
      }
      if(targetSplit) {
          // remove and add feature events are suppressed
          // listen for split event on this control instead
          this.layer.destroyFeatures(removals, {silent: true});
          this.layer.addFeatures(additions, {silent: true});
          this.events.triggerEvent("aftersplit", {
              source: sourceFeature,
              removed: removals,
              added: additions
          });
      }
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
        if (this.map) {
            this.map.events.unregister("buttonclick", this, this.handleButtonClick);
        }
        if (this.splitter) {
          this.splitter.destroy();
          this.splitter = null;
        }
        if (this.progresOverlay) {
          this.progressOverlay.destroy();
          this.progressOverlay = null;
        }
        this.layer = null;
        this.source = null;
        this.sourceOptions = null;
        this.targetFilter = null;
        this.undoLink = null;
        this.cancelLink = null;
        this.linksDiv = null;
        OpenLayers.Control.prototype.destroy.call(this);
    },

    CLASS_NAME: "OpenLayers.Control.SplitPolygon"
});
