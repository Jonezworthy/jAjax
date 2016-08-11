/* 
 * Author: AndrewJ 
 * URL : www.redditchweb.co.uk
 * Version: 0.8 - Alpha
 * Description:
 * 
 An AJAX library to end all AJAX libraries
 - Success callbacks
 - Taking too long callbacks
 - Priority ajax calls
 */

/* Here are the global settings */
/* You can find all of the features of this library in the example at the bottom */
var jAjaxSettings = {
    minPriority: 1 //Minimum priority 
    , maxPriority: 10 //Maximum priority - Note: Anything max priority ignores max connections
    , defaultPriority: 1 //If the individual ajax call has no priority, this is default
    , defaultMethod: "get" //Default HTTP method if none is specified
    , defaultCacheTime: 300 //Default cache time in seconds, or false or 0 for no cache
    , maxConnections: 3 //Max number of simultaneous Ajax calls - increase or decrease based on performance
    , patrolFrequency: 500 //How often the queue is checked and actioned in milliseconds
};
var jAjax = function (allOptions) {
    var that = {};
    for (var option in allOptions) {
        that[option] = allOptions[option];
    }

    that.method = typeof allOptions.method !== "undefined" ? allOptions.method : jAjaxSettings.defaultMethod;
    that.priority = typeof allOptions.priority !== "undefined" && allOptions.priority < jAjaxSettings.maxPriority ? allOptions.priority : jAjaxSettings.defaultPriority;
    that.cacheTime = typeof allOptions.cacheTime !== "undefined" ? allOptions.cacheTime : jAjaxSettings.defaultCacheTime;
    
    if (that.url) {
        var oJajaxCache = new jAjaxCache(that.url, that.cacheTime);
        if (that.cacheTime === 0 || that.cacheTime === false || !oJajaxCache.checkCache()) {
            //Adding to the queue
            if (typeof window.jAjaxQueue !== "object") {
                window.jAjaxQueue = {ready: {amount: 0}, active: {amount: 0}, complete: {amount: 0}};

            }
            if (typeof window.jAjaxQueue["ready"][that.priority] !== "object") {
                window.jAjaxQueue["ready"][that.priority] = {};
            }
            window.jAjaxQueue["ready"]["amount"]++;
            window.jAjaxQueue["ready"][that.priority][that.url] = that;

        } else {
            //Read from cache
            if (typeof allOptions.success === "function") {
                allOptions.success(oJajaxCache.getContent(), allOptions);
            }
            if (typeof allOptions.isCached === "function") {
                allOptions.isCached(oJajaxCache.getContent(), oJajaxCache.getCacheData());
            }
        }
    }

};
var jAjaxCache = function (url, cacheTime) {
    this.url = url;
    this.cacheTime = cacheTime;

    this.checkCache = function () {
        if (this.url && localStorage && JSON && localStorage.getItem(this.url)) { //FT
            var ajaxContent = JSON.parse(localStorage.getItem(this.url));

            if (ajaxContent.url && ajaxContent.dateTime && ajaxContent.content && ajaxContent.cacheLimit) {
                var cachedContentDate = new Date(ajaxContent.dateTime);
                var currentDate = new Date();
                var diff = Math.ceil(((currentDate.getTime() - cachedContentDate.getTime()) / 1000));
                if (diff < ajaxContent.cacheLimit) { //If cache hasn't expired
                    return true;
                } else {
                    return false;
                }
            } else { //Is corrupted
                localStorage.removeItem(this.url);
            }
        } else {
            return false;
        }
    };
    this.getContent = function () {
        if (localStorage && JSON) {//FT
            var ajaxCache = JSON.parse(localStorage.getItem(this.url));
            if (ajaxCache) {
                return ajaxCache.content || "";
            }
        }
    };
    this.getCacheData = function () {
        if (localStorage && JSON) { //FT
            return JSON.parse(localStorage.getItem(this.url));
        }
    };
    this.storeContent = function (ajaxContent) {
        if (localStorage && JSON) { //FT
            try {
                if (localStorage.getItem(this.url)) { //FT
                    localStorage.removeItem(this.url);
                }
                if (parseInt(cacheTime) !== 0 && ajaxContent.toString().length > 0) { //Save some execution by having this condition
                    localStorage.setItem(this.url, JSON.stringify({url: this.url, cacheLimit: cacheTime, dateTime: new Date().toString(), content: ajaxContent}));
                }
            } finally {
                return false;
            }
        }
    };
};
var jAjaxQueueController = function () {
    var maxPriority = typeof jAjaxSettings.maxPriority !== "undefined" ? jAjaxSettings.maxPriority : 10;
    var minPriority = typeof jAjaxSettings.minPriority !== "undefined" ? jAjaxSettings.minPriority : 1;
    var maxConnections = typeof jAjaxSettings.maxConnections !== "undefined" ? jAjaxSettings.maxConnections : 3;

    var queueControls = {
        processRequest: function (currentPriority, ajaxUrl) {
            var jAjaxQueueRequest = window.jAjaxQueue["active"][currentPriority][ajaxUrl];
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.open(jAjaxQueueRequest.method, jAjaxQueueRequest.url, true);
            xmlHttp.send();
            xmlHttp.onreadystatechange = function () {
                if (xmlHttp.status === 200 && xmlHttp.readyState === 4) {
                    jAjaxQueueController().changeStatus("active", "complete", jAjaxQueueRequest.priority, jAjaxQueueRequest.url);
                    if (typeof jAjaxQueueRequest.success === "function") {
                        if (jAjaxQueueRequest.cacheTime > 0) {
                            oJajaxCache = new jAjaxCache(jAjaxQueueRequest.url, jAjaxQueueRequest.cacheTime);
                            oJajaxCache.storeContent(xmlHttp.responseText);
                        }
                        jAjaxQueueRequest.success(xmlHttp.responseText, jAjaxQueueRequest, xmlHttp);
                    }
                    
                } else if (xmlHttp.readyState === 4) {
                    console.log("Ajax response: " + xmlHttp.status);
                }
            };

        }
        , changeStatus: function (oldStatus, newStatus, currentPriority, ajaxUrl) {
            window.jAjaxQueue[oldStatus]["amount"]--;
            window.jAjaxQueue[newStatus]["amount"]++;
            if (typeof window.jAjaxQueue[newStatus][currentPriority] !== "object") {
                window.jAjaxQueue[newStatus][currentPriority] = {};
            }
            window.jAjaxQueue[newStatus][currentPriority][ajaxUrl] = window.jAjaxQueue[oldStatus][currentPriority][ajaxUrl];
            window.jAjaxQueue[newStatus][currentPriority][ajaxUrl]["changedDateTime"] = new Date();
            delete window.jAjaxQueue[oldStatus][currentPriority][ajaxUrl];
        }
    };

    for (var currentPriority = maxPriority; currentPriority >= minPriority; currentPriority--) {
        //Check the ready queue
        for (var ajaxUrl in window.jAjaxQueue["ready"][currentPriority]) {
            if (typeof window.jAjaxQueue["ready"][currentPriority][ajaxUrl] === "object") { //FT
                if (window.jAjaxQueue["active"]["amount"] < maxConnections || currentPriority === maxPriority) { //If there is a connection slot
                    queueControls.changeStatus("ready", "active", currentPriority, ajaxUrl);
                    queueControls.processRequest(currentPriority, ajaxUrl);
                }
            }
        }
        //Check the active queue
        for (var ajaxUrl in window.jAjaxQueue["active"][currentPriority]) {
            var dateActive = window.jAjaxQueue["active"][currentPriority][ajaxUrl]["changedDateTime"];
            var dateCurrent = new Date();
            var dateDifferenceSeconds = Math.ceil((dateCurrent.getTime() - dateActive.getTime()) / 1000);

            for (var waitingValue in window.jAjaxQueue["active"][currentPriority][ajaxUrl]["waiting"]) {
                if (waitingValue <= dateDifferenceSeconds) {
                    if (typeof window.jAjaxQueue["active"][currentPriority][ajaxUrl]["waiting"][waitingValue] === "function") {
                        window.jAjaxQueue["active"][currentPriority][ajaxUrl]["waiting"][waitingValue](dateDifferenceSeconds);
                        delete window.jAjaxQueue["active"][currentPriority][ajaxUrl]["waiting"][waitingValue];
                    }
                }
            }
        }
    }
    return queueControls; //Return so can be used statically
};

(function () {
    var jAjaxPatrol = setInterval(function () {
        if (window.jAjaxQueue) {
            document.getElementById("readyAmount").innerHTML = "ready amount: " + window.jAjaxQueue["ready"]["amount"];
            document.getElementById("activeAmount").innerHTML = "active amount: " + window.jAjaxQueue["active"]["amount"];
            document.getElementById("completeAmount").innerHTML = "complete amount: " + window.jAjaxQueue["complete"]["amount"];

            document.getElementById("maxConnections").innerHTML = "max connections allowed in settings:" + jAjaxSettings.maxConnections;
            new jAjaxQueueController();

        }
    }, jAjaxSettings.patrolFrequency || 200);
})();

/***************************************************************************************************/
/********************************************* EXAMPLE *********************************************/
/***************************************************************************************************/
jAjax({
    url: "ajaxMe.php" //url to ajax
    , method: "get" //http method
    , priority: 10 //priority level (10: required, 1: do when you can
    , cacheTime: 900 //cache time, in seconds
    , isCached: function (response, cachedData) {
        /* This runs only when it was cached data
         * success method is called as well
         * PARAMS:
         * response: The cached response
         * cachedData: The data stored with the cached response - cached time, cache time it was stored with, url, etc
         */
    }
    , passthrough: true //This is an example of how you can pass through a property that is unique to this ajax call
    , waiting: {
        /* Waiting object is where you put functions you want to run if the ajax call hasn't finished in x amount of seconds */
        5: function (beenWaiting) {
            /* Ajax has been going on for 5+ seconds
             * PARAMS:
             * beenWaiting: amount of seconds since request started
             */
        }
        , 10: function (beenWaiting) {
            /* Ajax has been going on for 10+ seconds
             * PARAMS:
             * beenWaiting: amount of seconds since request started
             */
        }
    }
    , success: function (response, originalOptions, xmlHttpObject) { //callback
//        console.log("done");
        /* 
         * PARAMS:
         * Response: The response from the server/cached response
         * Original Options: The object passed into jAjax
         * XmlHttpObject: The actual AJAX object
         */
    }
});