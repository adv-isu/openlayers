/**
 * @requires OpenLayers/BaseTypes/Class.js
 */

/**
 * Class: OpenLayers.ProgressOverlay
 * Provides a transparent div to to cover user interface elements that should
 * be disabled during a long-running operation, providing feedback for that
 * operation in a small pane in the center of the screen and allowing the user
 * to cancel the operation with a button click.
 */
OpenLayers.ProgressOverlay = OpenLayers.Class({

    /**
     * Property: overlayDiv
     * {HTMLDivElement} The transparent div that covers the screen to prevent
     * user interaction.
     */
    overlayDiv: null,

    /**
     * Property: progressDiv
     * {HTMLDivElement} The opaque, centered div that shows task progress.
     */
    progressDiv: null,

    /**
     * Property: progressTextDiv
     * {HTMLDivElement} The div that shows the progress text (like "53% done").
     */
    progressTextDiv: null,

    /**
     * Property: cancelButton
     * {HTMLInputElement} The Cancel button.
     */
    cancelButton: null,

    /**
     * Property: actionName
     * {String} The name of the long-running operation.
     */
    actionName: null,

    /**
     * Property: events
     * {<OpenLayers.Events>} An events object for publishing events.
     */
    events: null,

    /**
     * Constructor: OpenLayers.ProgressOverlay
     * Creates a new ProgressOverlay.
     * 
     * Parameters:
     * doc - {HTMLDocument} The document to show progress in.
     * actionName - {String} The name of the action, for display
     * options - {Object} Additional optional parameters that become
     * properties on this object.
     */
    initialize: function(doc, actionName, options) {
        OpenLayers.Util.extend(this, options);
        this.events = new OpenLayers.Events(this);

        this.actionName = actionName;
        var scope = this;
        this.overlayDiv = doc.createElement("div");
        this.overlayDiv.style.position = "absolute";
        this.overlayDiv.style.left = "0px";
        this.overlayDiv.style.right = "0px";
        this.overlayDiv.style.top = "0px";
        this.overlayDiv.style.bottom = "0px";
        this.overlayDiv.style.zIndex = "10000000";
        this.overlayDiv.style.backgroundColor = "transparent";
        this.overlayDiv.ontouchmove = function(evt) {
          evt.preventDefault()
        };
        this.progressDiv = doc.createElement("div");
        this.progressDiv.className = "olControlProgress";
        this.progressDiv.style.position = "absolute";
        this.progressDiv.style.top = "50%";
        this.progressDiv.style.left ="50%";
        this.progressTextDiv = doc.createElement("div");
        this.progressDiv.appendChild(this.progressTextDiv);
        this.cancelButton = doc.createElement("input");
        this.cancelButton.setAttribute("type", "button");
        this.cancelButton.setAttribute("value", "Cancel");
        this.cancelButton.onclick = function() {
          scope.hide();
          scope.events.triggerEvent("cancel");
        };
        this.progressDiv.appendChild(this.cancelButton);
        this.overlayDiv.appendChild(this.progressDiv);
    },

    /**
     * Method: show
     * Shows the ProgressOverlay.
     */
    show: function() {
      if (!this.overlayDiv.parentNode) {
        this.overlayDiv.ownerDocument.body.appendChild(this.overlayDiv);
      }
      this.update(0);
    },

    /**
     * Method: hide
     * Hides the ProgressOverlay.
     */
    hide: function() {
      if (!!this.overlayDiv && !!this.overlayDiv.parentNode) {
        this.overlayDiv.parentNode.removeChild(this.overlayDiv);
      }
    },

    /**
     * Method: update
     * Updates the ProgressOverlay.
     * 
     * Parameters:
     * val - {String|Float} The string or completeness fraction to display.
     */
    update: function(val) {
      if (typeof val == "string") {
        this.progressTextDiv.innerHTML = val;
      }
      else {
        this.progressTextDiv.innerHTML = this.actionName + " is " +
          Math.round(val * 100) + "% complete!";
      }
      this.progressDiv.style.marginTop = "-" + this.progressDiv.offsetHeight / 2 + "px";
      this.progressDiv.style.marginLeft = "-" + this.progressDiv.offsetWidth / 2 + "px";
    },

    /**
     * Method: destroy
     * Destroys the ProgressOverlay.  Mostly this is cleanup code for the events.
     */
    destroy: function() {
      this.hide();
      if (this.overlayDiv) {
        this.overlayDiv.ontouchmove = null;
      }
      this.overlayDiv = null;
      this.progressDiv = null;
      this.progressTextDiv = null;
      if (this.cancelButton != null) {
        this.cancelButton.onclick = null;
      }
      this.cancelButton = null;
      if(this.events) {
          if(this.eventListeners) {
              this.events.un(this.eventListeners);
          }
          this.events.destroy();
          this.events = null;
      }
      this.eventListeners = null;
    },

    CLASS_NAME: "OpenLayers.ProgressOverlay"

});
