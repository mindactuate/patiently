/**
 * Waiter based on API rate limits you enter manually
 *
 *    import coffeebreak from "coffeebreak";
 *
 *    let options = {
 *      startWaitingCallback: function, // default is function(){}, calls a function if waiting necessary
 *      endWaitingCallback: function, // default is function(){}, calls a function after waiting
 *      waitingTickCallback: function, // default is function(){}, calls a function every tick
 *      minutelyLimit: integer, // default is -1 (no minutely limit set)
 *      hourlyLimit: integer, // default is -1 (no hourly limit set)
 *    }
 *
 *    var limitWaiter = waiter.LimitWaiter(options);
 *
 *    let myApiCallFunction = async () => {
 *        await limitWaiter.checkLimits()
 *            .then(info => { // get info about waiter status })
 *        // continue with your api call
 *    }
 *
 * @param {Object} options
 * @constructor
 */
function LimitWaiter(options) {
    this.mLim = options ? options.minutelyLimit ? options.minutelyLimit : -1 : -1;
    this.hLim = options ? options.hourlyLimit ? options.hourlyLimit : -1 : -1;
    this.startWaitingCallback = options ? options.startWaitingCallback ? options.startWaitingCallback : function () { } : function () { };
    this.endWaitingCallback = options ? options.endWaitingCallback ? options.endWaitingCallback : function () { } : function () { };
    this.waitingTickCallback = options ? options.waitingTickCallback ? options.waitingTickCallback : function () { } : function () { };
    this.mC = 0;
    this.hC = 0;
    this.totalC = 0;
}

/**
 * Number format given by the x-ratelimit-reset header
 *
 * UNIXEPOCHTIME (UTC, GMT0) should be in seconds (e.g. 1555711620) or milliseconds (e.g. 1555711620000) since the UNIX epoch (January 1, 1970 00:00:00 UTC), please test beforehand (https://www.epochconverter.com)
 *
 */
var ResetHeaderType = {
    UNIXEPOCHTIMEINMILLISECONDS: "unix-ms",
    UNIXEPOCHTIMEINSECONDS: "unix-s",
    MILLISECONDSCOUNT: 1 / 1000,
    SECONDSCOUNT: 1,
    MINUTESCOUNT: 60,
    HOURSCOUNT: 3600
}

/**
 * Waiter based on API response headers like x-ratelimit-...
 *
 *    import coffeebreak from "coffeebreak";
 *
 *    let options = {
 *      startWaitingCallback: function, // default is function(){}, calls a function if waiting necessary
 *      endWaitingCallback: function, // default is function(){}, calls a function after waiting
 *      waitingTickCallback: function, // default is function(){}, calls a function every tick
 *      limitHeaderName: string, // default is "x-ratelimit-limit"
 *      remainHeaderName: string, // default is "x-ratelimit-remaining"
 *      resetHeaderName: string, // default is "x-ratelimit-reset"
 *      resetHeaderType: ResetHeaderType // default is ResetHeaderType.UNIXEPOCHTIMEINSECONDS
 *    }
 *
 *    let xRateLimitWaiter = new waiter.XRateLimitWaiter(options);
 *
 *    let myApiCallFunction = async () => {
 *        await xRateLimitWaiter.checkLimits()
 *            .then(info => { // get info about waiter status })
 *            .catch(error => { // get error info, headers maybe corrupt })
 *        // continue with your api call
 *        await axios.get(url)
 *            .then(res => {
 *                xRateLimitWaiter.updateLimits(res.headers);
 *                ...
 *            })
 *            .catch(err => {...})
 *    }
 *
 * @param {Object} options
 * @constructor
 */
function XRateLimitWaiter(options) {
    // init
    this.startWaitingCallback = options ? options.startWaitingCallback ? options.startWaitingCallback : function () { } : function () { };
    this.endWaitingCallback = options ? options.endWaitingCallback ? options.endWaitingCallback : function () { } : function () { };
    this.waitingTickCallback = options ? options.waitingTickCallback ? options.waitingTickCallback : function () { } : function () { };
    this.limitHeaderName = options ? options.limitHeaderName ? options.limitHeaderName : "x-ratelimit-limit" : "x-ratelimit-limit";
    this.remainHeaderName = options ? options.remainHeaderName ? options.remainHeaderName : "x-ratelimit-remaining" : "x-ratelimit-remaining";
    this.resetHeaderName = options ? options.resetHeaderName ? options.resetHeaderName : "x-ratelimit-reset" : "x-ratelimit-reset";
    this.resetHeaderType = options ? options.resetHeaderType ? options.resetHeaderType : ResetHeaderType.UNIXEPOCHTIMEINSECONDS : ResetHeaderType.UNIXEPOCHTIMEINSECONDS;
    this.rawHeaders = null;
    this.init = true;
    this.xRLimit = 0;
    this.xRRemain = 0;
    this.xRReset = 0;
}

XRateLimitWaiter.prototype.updateLimits = function (responseHeaders) {
    this.rawHeaders = responseHeaders;
    this.xRLimit = Number.parseInt(responseHeaders[this.limitHeaderName]);
    this.xRRemain = Number.parseInt(responseHeaders[this.remainHeaderName]);
    this.xRReset = Number.parseInt(responseHeaders[this.resetHeaderName]);
}

XRateLimitWaiter.prototype.checkLimits = function () {
    return new Promise((resolve, reject) => {
        // first call, no header values set yet
        if (this.init) {
            this.init = false;
            resolve({
                limit: this.xRLimit,
                remain: this.xRRemain,
                reset: this.xRReset
            });
        } else {
            if (Number.isSafeInteger(this.xRLimit) && Number.isSafeInteger(this.xRRemain) && Number.isSafeInteger(this.xRReset)) {
                if (this.xRRemain === 0) {
                    let seconds = 0;
                    let r = null;
                    let d = null;
                    if (this.resetHeaderType === ResetHeaderType.UNIXEPOCHTIMEINMILLISECONDS) {
                        r = new Date(this.xRReset);
                        d = new Date();
                        seconds = Math.ceil((r - d) / 1000);
                    } else if (this.resetHeaderType === ResetHeaderType.UNIXEPOCHTIMEINSECONDS) {
                        r = new Date(this.xRReset * 1000);
                        d = new Date();
                        seconds = Math.ceil((r - d) / 1000);
                    } else {
                        seconds = Math.ceil(this.resetHeaderType * this.xRReset);
                    }
                    this.startWaitingCallback({
                        limit: this.xRLimit,
                        remain: this.xRRemain,
                        reset: this.xRReset,
                        currentTimeStamp: d,
                        resetTimeStamp: r,
                        secondsToWaitTilReset: seconds
                    })
                    waitSeconds(seconds, this.waitingTickCallback).then(() => {
                        this.endWaitingCallback({
                            secondsWaited: seconds
                        })
                        resolve({
                            limit: this.xRLimit,
                            remain: this.xRRemain,
                            reset: this.xRReset
                        });
                    })
                } else {
                    resolve({
                        limit: this.xRLimit,
                        remain: this.xRRemain,
                        reset: this.xRReset
                    });
                }
            } else {
                reject({
                    error: "no valid headers or header values",
                    headers: this.rawHeaders,
                    setLimitHeaderName: this.limitHeaderName,
                    setRemainHeaderName: this.remainHeaderName,
                    setResetHeaderName: this.resetHeaderName,
                    setResetHeaderType: this.resetHeaderType
                });
            }
        }
    })
}

LimitWaiter.prototype.checkLimits = function () {
    return new Promise((resolve, reject) => {
        this.mC++;
        this.hC++;
        this.totalC++;
        if (this.mC < this.mLim && this.hC < this.hLim) {
            resolve({
                currentCallsInAMinute: this.mC,
                currentCallsInAnHour: this.hC,
                totalCalls: this.totalC
            });
        } else if (this.hC === this.hLim) {
            let d = new Date().getMinutes();
            let minutes = 60 - d;
            let seconds = minutes * 60;
            this.startWaitingCallback({
                currentCallsInAnHour: this.hC,
                hourlyLimit: this.mLim,
                secondsToWaitTilNextHour: seconds
            })
            waitSeconds(seconds, this.waitingTickCallback).then(() => {
                this.hC = 0;
                this.mC = 0;
                this.endWaitingCallback({
                    secondsWaited: seconds
                })
                resolve({
                    currentCallsInAMinute: this.mC,
                    currentCallsInAnHour: this.hC,
                    totalCalls: this.totalC
                });
            })
        } else if (this.mC === this.mLim) {
            let d = new Date().getSeconds();
            let seconds = 60 - d;
            this.startWaitingCallback({
                currentCallsInAMinute: this.mC,
                minutelyLimit: this.mLim,
                secondsToWaitTilNextMinute: seconds
            })
            waitSeconds(seconds, this.waitingTickCallback).then(() => {
                this.mC = 0;
                this.endWaitingCallback({
                    secondsWaited: seconds
                })
                resolve({
                    currentCallsInAMinute: this.mC,
                    currentCallsInAnHour: this.hC,
                    totalCalls: this.totalC
                });
            })
        }
    });
}

function waitSeconds(seconds, tickCallback) {
    return new Promise(function (resolve) {
        let count = 0;
        let v = setInterval(function () {
            tickCallback({
                secondsToWait: seconds - count,
                secondsWaited: count
            })
            count++;
            if (count > seconds) {
                clearInterval(v);
                resolve();
            }
        }, 1000)
    })
}

exports.ResetHeaderType = ResetHeaderType;
exports.XRateLimitWaiter = XRateLimitWaiter;
exports.LimitWaiter = LimitWaiter;