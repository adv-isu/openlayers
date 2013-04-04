/* Copyright (c) 2006-2012 by OpenLayers Contributors (see authors.txt for
 * full list of contributors). Published under the 2-clause BSD license.
 * See license.txt in the OpenLayers distribution or repository for the
 * full text of the license. */

/**
 * @requires OpenLayers/BaseTypes/Class.js
 */

/**
 * Class: OpenLayers.StepSplitter
 */
OpenLayers.StepSplitter = OpenLayers.Class({

    sourceFeature: null,

    sourceEnv: null,

    jstsSource: null,

    features: null,

    complete: false,

    eventListeners: null,

    events: null,

    parser: null,

    numFeatures: 0,

    splitFeatureCount: 0,

    canceled: false,

    featureIndex: 0,

    featureSplitter: null,

    splitResults: null,

    initialize: function(sourceFeature, features, options) {
      if (sourceFeature != null) {
        this.sourceFeature = sourceFeature;
      }
      this.splitResults = [];
      this.features = features || [];
      this.parser = new jsts.io.OpenLayersParser();
      this.jstsSource = this.parser.read(sourceFeature.geometry);
      OpenLayers.Util.extend(this, options);
      this.events = new OpenLayers.Events(this);
      if(this.eventListeners instanceof Object) {
          this.events.on(this.eventListeners);
      }
      this.parser = new jsts.io.OpenLayersParser();
      this.numFeatures = this.features.length;
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
      if (this.canceled) {
        return false;
      }
      if (this.ensureSplitter()) {
        var addl = 0;
        if (this.featureSplitter.step()) {
          addl =  this.featureSplitter.fractionDone;
        }
        else {
          this.splitFeatureCount++;
          this.splitResults.push({
            feature: this.featureSplitter.targetFeature,
            parts: this.featureSplitter.targetParts
          });
          this.featureSplitter.destroy();
          this.featureSplitter = null;
          this.featureIndex++;
        }
        this.events.triggerEvent("progress", {fractionDone: (this.splitFeatureCount + addl) / this.numFeatures});
      }
      else {
        this.complete = true;
        this.events.triggerEvent("complete");
      }
      return true;
    },

    ensureSplitter: function() {
      if (this.featureSplitter == null) {
        if (this.featureIndex >= this.features.length) {
          return false;
        }
        this.featureSplitter = new OpenLayers.StepFeatureSplitter(
          this.sourceFeature, this.jstsSource, this.features[this.featureIndex],
          this.parser, {});
      }
      return true;
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

    CLASS_NAME: "OpenLayers.StepSplitter"
});
