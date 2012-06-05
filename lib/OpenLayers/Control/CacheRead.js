/* Copyright (c) 2006-2012 by OpenLayers Contributors (see authors.txt for
 * full list of contributors). Published under the Clear BSD license.
 * See http://svn.openlayers.org/trunk/openlayers/license.txt for the
 * full text of the license. */

/**
 * @requires OpenLayers/Control.js
 */

/**
 * Class: OpenLayers.Control.CacheRead
 * A control for using image tiles cached with <OpenLayers.Control.CacheWrite>
 * from the browser's local storage.
 *
 * Inherits from:
 *  - <OpenLayers.Control>
 */
OpenLayers.Control.CacheRead = OpenLayers.Class(OpenLayers.Control, {

    /**
     * APIProperty: fetchEvent
     * {String} The layer event to listen to for replacing remote resource tile
     *     URLs with cached data URIs. Supported values are "tileerror" (try
     *     remote first, fall back to cached) and "tileloadstart" (try cache
     *     first, fall back to remote). Default is "tileloadstart".
     *
     *     Note that "tileerror" will not work for CORS enabled images (see
     *     https://developer.mozilla.org/en/CORS_Enabled_Image), i.e. layers
     *     configured with a <OpenLayers.Tile.Image.crossOriginKeyword> in
     *     <OpenLayers.Layer.Grid.tileOptions>.
     */
    fetchEvent: "tileloadstart",

    /**
     * APIProperty: layers
     * {Array(<OpenLayers.Layer.Grid>)}. Optional. If provided, only these
     *     layers will receive tiles from the cache.
     */
    layers: null,

    /**
     * APIProperty: autoActivate
     * {Boolean} Activate the control when it is added to a map.  Default is
     *     true.
     */
    autoActivate: true,

    /**
     * APIProperty: databaseName
     * {String} The name of the database used for caching
     */
    databaseName: "OpenLayersTileCacheDB",

    /**
     * APIProperty: tableName
     * {String} The name of the table used for caching
     */
    tableName: "OLIMAGE",

    imdb: null,

    /**
     * Constructor: OpenLayers.Control.CacheRead
     *
     * Parameters:
     * options - {Object} Object with API properties for this control
     */
    initialize: function(options) {
        OpenLayers.Control.prototype.initialize.apply(this, [options]);
        if (!!window.openDatabase) {
            try {
                this.imdb = openDatabase(this.databaseName, '1.0',
                        'OpenLayers Image Cache Database', 5*1024*1024);
            }
            catch (outererr) {
//                log("probably failing to connect to database: " + JSON.stringify(outererr));
            }
        }
    },

    /**
     * Method: setMap
     * Set the map property for the control.
     *
     * Parameters:
     * map - {<OpenLayers.Map>}
     */
    setMap: function(map) {
        OpenLayers.Control.prototype.setMap.apply(this, arguments);
        var i, layers = this.layers || map.layers;
        for (i=layers.length-1; i>=0; --i) {
            this.addLayer({layer: layers[i]});
        }
        if (!this.layers) {
            map.events.on({
                addlayer: this.addLayer,
                removeLayer: this.removeLayer,
                scope: this
            });
        }
    },

    /**
     * Method: addLayer
     * Adds a layer to the control. Once added, tiles requested for this layer
     *     will be cached.
     *
     * Parameters:
     * evt - {Object} Object with a layer property referencing an
     *     <OpenLayers.Layer> instance
     */
    addLayer: function(evt) {
        evt.layer.events.register(this.fetchEvent, this, this.fetch);
    },

    /**
     * Method: removeLayer
     * Removes a layer from the control. Once removed, tiles requested for this
     *     layer will no longer be cached.
     *
     * Parameters:
     * evt - {Object} Object with a layer property referencing an
     *     <OpenLayers.Layer> instance
     */
    removeLayer: function(evt) {
        evt.layer.events.unregister(this.fetchEvent, this, this.fetch);
    },

    /**
     * Method: fetch
     * Listener to the <fetchEvent> event. Replaces a tile's url with a data
     * URI from the cache.
     *
     * Parameters:
     * evt - {Object} Event object with a tile property.
     */
    fetch: function(evt) {
//        if (this.active && window.localStorage &&
//                evt.tile instanceof OpenLayers.Tile.Image) {
//            var tile = evt.tile,
//                url = tile.url;
//            // deal with modified tile urls when both CacheWrite and CacheRead
//            // are active
//            if (!tile.layer.crossOriginKeyword && OpenLayers.ProxyHost &&
//                    url.indexOf(OpenLayers.ProxyHost) === 0) {
//                url = OpenLayers.Control.CacheWrite.urlMap[url];
//            }
//            var dataURI = window.localStorage.getItem("olCache_" + url);
//            if (dataURI) {
//                tile.url = dataURI;
//                if (evt.type === "tileerror") {
//                    tile.setImgSrc(dataURI);
//                }
//            }
//        }

        if (this.active && this.imdb != null &&
                evt.tile instanceof OpenLayers.Tile.Image) {
            try {
                var tile = evt.tile,
                    url = tile.url,
                    origUrl = tile.url,
                    urlMap = OpenLayers.Control.CacheWrite.urlMap;
                // deal with modified tile urls when both CacheWrite and CacheRead
                // are active
                if (!tile.layer.crossOriginKeyword && OpenLayers.ProxyHost &&
                        url.indexOf(OpenLayers.ProxyHost) === 0) {
                    url = urlMap[url];
                }

                var tableName = this.tableName;

                this.imdb.transaction(function(tx) {
                    tx.executeSql('select image from ' + tableName + ' where url = ?',
                    [url],
                    function(tx, results) // table exists
                    {
                      if (results != null && results.rows.length > 0) {
                        var dataURI = results.rows.item(0).image;
                        if (dataURI == null || dataURI == "") {
//                          log("got junk URL");
                        }
                        else {
                          if ((tile.url === origUrl ||
                            origUrl === urlMap[tile.url]) &&
                            tile.url.substr(0, 5) !== 'data:') {

                            var img = tile.getImage();
                            OpenLayers.Event.stopObservingElement(img);
                            OpenLayers.Event.observe(img, "load",
                                OpenLayers.Function.bind(tile.onImageLoad, tile)
                            );
                            OpenLayers.Event.observe(img, "error",
                                OpenLayers.Function.bind(tile.onImageError, tile)
                            );
                            OpenLayers.Element.removeClass(img, "olImageLoadError");
                            tile.imageReloadAttempts = 0;
                            tile.isLoading = true;
                            tile.url = dataURI;
                            tile.setImgSrc(dataURI);
                          }
                          else {
    //                        log("failed tile.url tests!");
    //                        log("tile.url = " + tile.url);
    //                        log("origUrl = " + origUrl);
                          }
                        }
                      }
                      else {
//                        log("results.rows.length = " + results.rows.length + "!");
//                        log("image not in database for url: " + origUrl);
                      }
                    },
                    function(tx, err)
                    {
//                      log("couldn't get image: " + JSON.stringify(err));
                    });
                });
            }
            catch (outererr) {
//              log("probably failing to connect to database: " + JSON.stringify(outererr));
            }
        }
    },

    /**
     * Method: destroy
     * The destroy method is used to perform any clean up before the control
     * is dereferenced.  Typically this is where event listeners are removed
     * to prevent memory leaks.
     */
    destroy: function() {
        if (this.layers || this.map) {
            var i, layers = this.layers || this.map.layers;
            for (i=layers.length-1; i>=0; --i) {
                this.removeLayer({layer: layers[i]});
            }
        }
        if (this.map) {
            this.map.events.un({
                addlayer: this.addLayer,
                removeLayer: this.removeLayer,
                scope: this
            });
        }
        OpenLayers.Control.prototype.destroy.apply(this, arguments);
    },

    CLASS_NAME: "OpenLayers.Control.CacheRead"
});