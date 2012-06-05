/* Copyright (c) 2006-2012 by OpenLayers Contributors (see authors.txt for
 * full list of contributors). Published under the Clear BSD license.
 * See http://svn.openlayers.org/trunk/openlayers/license.txt for the
 * full text of the license. */

/**
 * @requires OpenLayers/Control.js
 * @requires OpenLayers/Request.js
 * @requires OpenLayers/Console.js
 */

/**
 * Class: OpenLayers.Control.CacheWrite
 * A control for caching image tiles in the browser's local storage. The
 * <OpenLayers.Control.CacheRead> control is used to fetch and use the cached
 * tile images.
 *
 * Note: Before using this control on any layer that is not your own, make sure
 * that the terms of service of the tile provider allow local storage of tiles.
 *
 * Inherits from:
 *  - <OpenLayers.Control>
 */
OpenLayers.Control.CacheWrite = OpenLayers.Class(OpenLayers.Control, {

    /**
     * APIProperty: events
     * {<OpenLayers.Events>} Events instance for listeners and triggering
     *     control specific events.
     *
     * To register events in the constructor, configure <eventListeners>.
     *
     * Register a listener for a particular event with the following syntax:
     * (code)
     * control.events.register(type, obj, listener);
     * (end)
     *
     * Supported event types (in addition to those from <OpenLayers.Control.events>):
     * cachefull - Triggered when the cache is full. Listeners receive an
     *     object with a tile property as first argument. The tile references
     *     the tile that couldn't be cached.
     */

    /**
     * APIProperty: eventListeners
     * {Object} Object with event listeners, keyed by event name. An optional
     *     scope property defines the scope that listeners will be executed in.
     */

    /**
     * APIProperty: layers
     * {Array(<OpenLayers.Layer.Grid>)}. Optional. If provided, caching
     *     will be enabled for these layers only, otherwise for all cacheable
     *     layers.
     */
    layers: null,

    /**
     * APIProperty: imageFormat
     * {String} The image format used for caching. The default is "image/png".
     *     Supported formats depend on the user agent. If an unsupported
     *     <imageFormat> is provided, "image/png" will be used. For aerial
     *     imagery, "image/jpeg" is recommended.
     */
    imageFormat: "image/png",

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

    /**
     * Property: quotaRegEx
     * {RegExp}
     */
    quotaRegEx: (/quota/i),
    
    imdb: null,

    /**
     * Constructor: OpenLayers.Control.CacheWrite
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
        evt.layer.events.on({
            tileloadstart: this.makeSameOrigin,
            tileloaded: this.cache,
            scope: this
        });
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
        evt.layer.events.un({
            tileloadstart: this.makeSameOrigin,
            tileloaded: this.cache,
            scope: this
        });
    },

    /**
     * Method: makeSameOrigin
     * If the tile does not have CORS image loading enabled and is from a
     * different origin, use OpenLayers.ProxyHost to make it a same origin url.
     *
     * Parameters:
     * evt - {<OpenLayers.Event>}
     */
    makeSameOrigin: function(evt) {
        if (this.active) {
            var tile = evt.tile;
            if (tile instanceof OpenLayers.Tile.Image &&
                    !tile.crossOriginKeyword &&
                    tile.url.substr(0, 5) !== "data:") {
                var sameOriginUrl = OpenLayers.Request.makeSameOrigin(
                    tile.url, OpenLayers.ProxyHost
                );
                OpenLayers.Control.CacheWrite.urlMap[sameOriginUrl] = tile.url;
                tile.url = sameOriginUrl;
            }
        }
    },

    /**
     * Method: cache
     * Adds a tile to the cache. When the cache is full, the "cachefull" event
     * is triggered.
     *
     * Parameters:
     * obj - {Object} Object with a tile property, tile being the
     *     <OpenLayers.Tile.Image> with the data to add to the cache
     */
    cache: function(obj) {
//          if (this.active && window.localStorage) {
//            var tile = obj.tile;
//            if (tile instanceof OpenLayers.Tile.Image &&
//                    tile.url.substr(0, 5) !== 'data:') {
//                try {
//                    var canvasContext = tile.getCanvasContext();
//                    if (canvasContext) {
//                        window.localStorage.setItem(
//                            "olCache_" + OpenLayers.Control.CacheWrite.urlMap[tile.url],
//                            canvasContext.canvas.toDataURL(this.imageFormat)
//                        );
//                        delete OpenLayers.Control.CacheWrite.urlMap[tile.url];
//                    }
//                } catch(e) {
//                    // local storage full or CORS violation
//                    var reason = e.name || e.message;
//                    if (reason && this.quotaRegEx.test(reason)) {
//                        this.events.triggerEvent("cachefull", {tile: tile});
//                    } else {
//                        OpenLayers.Console.error(e.toString());
//                    }
//                }
//            }
//        }


        if (this.active && this.imdb != null) {
            try {
                var tile = obj.tile;
                var tableName = this.tableName;
                var imageFormat = this.imageFormat;
                var urlMap = OpenLayers.Control.CacheWrite.urlMap;
                var url = tile.url;
                var unloading = false;
                var current = this.cache; // the cache method of this class
                var i = 0;
                // UGLY HACK: OpenLayers recycles tiles, sometimes while their
                // images are still loading.  When this happens, the tile triggers
                // an "unload" event.  Unfortunately, the layer (to whose events
                // we are hooked) treats an "unload" event the same as a "loaded"
                // event.  We don't want to cache a tile when it is being unloaded,
                // as its image data will be missing and it will cause us to store
                // blank imagery in our database.  The easiest way I found to avoid
                // caching those tiles was to dig through the call stack looking
                // for "unload" in a parameter name.  This is horrible, and I'm
                // sorry.  But it works.
                // There are better ways of solving this if you want to modify
                // OpenLayers itself.  I took the approach of using an unmodified
                // OpenLayers build and adding these caching classes on top.  That's
                // partly why this is such a weird fix.
                while(current && i < 10) {
                  if (current.arguments.length > 0 &&
                    (current.arguments[0].type === "unload" ||
                     current.arguments[0].type === "loaderror")) {
                    unloading = true;
                    break;
                  }
                  current = current.caller;
                  i++;
                }

                if (this.imdb !== null && tile instanceof OpenLayers.Tile.Image &&
                        url.substr(0, 5) !== 'data:' && !unloading &&
                        !!tile.imgDiv && tile.imgDiv.getAttribute("src") === url &&
                        !OpenLayers.Element.hasClass(tile.imgDiv, "olImageLoadError")) {
                    try {
                        var canvasContext = tile.getCanvasContext();
                        var width = canvasContext.canvas.width;
                        var height = canvasContext.canvas.height;
                        if (canvasContext) {
                            var imgdat = canvasContext.getImageData(0,0,width,height);
                            var data = imgdat.data;
                            var allOneColor = true;
                            var r = -1, g = -1, b = -1, a = -1;
                            for (var i = 0, len = imgdat.width * imgdat.height * 4; i < len; i += 4) {
                              if (i == 0) {
                                r = data[i];
                                g = data[i + 1];
                                b = data[i + 2];
                                a = data[i + 3];
                              }
                              else {
                                if (data[i] != r || data[i + 1] != g ||
                                    data[i + 2] != b || data[i + 3] != a) {
                                    allOneColor = false;
                                    break;
                                }
                              }
                            }
                            if (allOneColor) {
//                              log("Got an empty image!  r = " + r + "; g = " + g +
//                                "; b = " + b + "; a = " + a);
                              return;
                            }
                            var dataUrl = null;
                            try {
                              dataUrl = canvasContext.canvas.toDataURL(imageFormat);
                            }
                            catch(ex) {
//                              log("exception getting dataUrl: " + ex);
                              return;
                            }
                            imgdat = null; // don't keep this around in the closure
                            data = null; // don't keep this around in the closure
                            canvasContext = null; // don't keep this around in the closure
                            tile.canvasContext = null; // the tile can recreate this
                            this.imdb.transaction(function(tx) {
                              tx.executeSql('create table if not exists ' + tableName + ' (url unique, image)',
                              [],
                              function(tx, results) // table exists
                              {
                                if (dataUrl != null && dataUrl != "") {
                                  tx.executeSql('insert into ' + tableName + ' values(?,?)',
                                      [urlMap[url], dataUrl],
                                      function(tx, results) // insert success
                                      {
                                          delete urlMap[url];
                                      },
                                      function(tx, err) // insert failure
                                      {
                                          tx.executeSql('update ' + tableName + ' set image = ? where url = ?',
                                            [dataUrl, urlMap[url] ],
                                            function(tx, results) // update success
                                            {
    //                                            var myimg = document.createElement('img');
    //                                            myimg.setAttribute("src", dataUrl);
    //                                            myimg.setAttribute("style", "border: 1px solid green");
    //                                            document.getElementById("debug").appendChild(myimg);
    //                                            document.getElementById("debug").appendChild(document.createTextNode(imgsrc));
                                                delete urlMap[url];
                                            },
                                            function(tx, err) // update failure
                                            {
                                                OpenLayers.Console.log("image not updated!");
                                            }
                                          );
                                      }
                                  );
                                }
                                else {
                                  "dataUrl is null or something: " + dataUrl;
                                }
                              },
                              function(tx, err) // table doesn't exist
                              {
                                OpenLayers.Console.log("couldn't create table for image storage!");
                              });
                            });
                        }
                    } catch(e) {
                        // local storage full or CORS violation
                        var reason = e.name || e.message;
                        if (reason && this.quotaRegEx.test(reason)) {
                            this.events.triggerEvent("cachefull", {tile: tile});
                        } else {
                            OpenLayers.Console.error(e.toString());
                        }
                    }
                }
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

    clearCache: function() {
        if (this.active &&  this.imdb != null) {
            var tableName = this.tableName;
            this.imdb.transaction(function(tx) {
                tx.executeSql('delete from ' + tableName,
                [],
                function(tx, results) // table exists
                {
                  alert("Successfully cleared the image cache!");
                  OpenLayers.Console.log("Cleared the imagery database!");
                },
                function(tx, err) // table doesn't exist
                {
                  OpenLayers.Console.log("Couldn't create table for image storage!");
                });
            });
        }
    },

    CLASS_NAME: "OpenLayers.Control.CacheWrite"
});

/**
 * Property: OpenLayers.Control.CacheWrite.urlMap
 * {Object} Mapping of same origin urls to cache url keys. Entries will be
 *     deleted as soon as a tile was cached.
 */
OpenLayers.Control.CacheWrite.urlMap = {};
