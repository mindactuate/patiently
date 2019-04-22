const x = Infinity;

/**
 * Waiter based on API rate limits you enter manually
 *
 *    import patiently from "patiently";
 *
 *    let options = {
 *      startWaitingCallback: {function}, // default is function(){}, calls a function if waiting necessary
 *      endWaitingCallback: {function}, // default is function(){}, calls a function after waiting
 *      waitingTickCallback: {function}, // default is function(){}, calls a function every tick
 *      minutelyLimit: {integer}, // default is Infinity (no minutely limit set)
 *      hourlyLimit: {integer}, // default is Infinity (no hourly limit set)
 *      test: {boolean}, // default is false (if true, max waiting time is 5 secs)
 *    }
 *
 *    var limitWaiter = waiter.LimitWaiter(options);
 *
 *    let myApiCallFunction = async () => {
 *        limitWaiter.wait(function(){
 *           // your api call
 *        })
 *    }
 *
 * @param {Object} options
 * @constructor
 */
function LimitWaiter(options) {
    this.mLim = options ? options.minutelyLimit ? Number.isSafeInteger(options.minutelyLimit) ? options.minutelyLimit > 0 ? options.minutelyLimit : x : x : x : x;
    this.hLim = options ? options.hourlyLimit ? Number.isSafeInteger(options.hourlyLimit) ? options.hourlyLimit > 0 ? options.hourlyLimit : x : x : x : x;
    this.startWaitingCallback = options ? options.startWaitingCallback ? options.startWaitingCallback : function () { } : function () { };
    this.endWaitingCallback = options ? options.endWaitingCallback ? options.endWaitingCallback : function () { } : function () { };
    this.waitingTickCallback = options ? options.waitingTickCallback ? options.waitingTickCallback : function () { } : function () { };
    this.test = options ? options.test ? options.test : false : false;
    this.mC = 0;
    this.hC = 0;
    this.totalC = 0;
    this.callbackQueue = [];
    this.alreadyWorking = false;
}

LimitWaiter.prototype.wait = function (apiCallFunction) {
    this.callbackQueue.push(apiCallFunction);
    if (!this.alreadyWorking) {
        workOnQueueLW(this); // trigger working
    }
}

let workOnQueueLW = async (ctx) => {
    while (ctx.callbackQueue.length > 0) {
        ctx.alreadyWorking = true;
        await checkWaitingLW(ctx)
            .then(() => {
                let cb = ctx.callbackQueue[0];
                ctx.callbackQueue.shift();
                cb();
                // manage counters
                ctx.mC++;
                ctx.hC++;
                ctx.totalC++;
            })
    }
    ctx.alreadyWorking = false;
}

function checkWaitingLW(ctx) {
    return new Promise(function (resolve) {
        if (ctx.mC < ctx.mLim && ctx.hC < ctx.hLim) {
            resolve(); // do not have to wait
        } else if (ctx.hC >= ctx.hLim) {
            let d = new Date().getMinutes();
            let minutes = 60 - d;
            let seconds = minutes * 60;
            ctx.startWaitingCallback({
                currentCallsInAnHour: ctx.hC,
                hourlyLimit: ctx.hLim,
                secondsToWaitTilNextHour: seconds
            })
            seconds = ctx.test ? 5 : seconds;
            waitSeconds(seconds, ctx.waitingTickCallback)
                .then(() => {
                    ctx.hC = ctx.mC = 0;
                    ctx.endWaitingCallback({
                        secondsWaited: seconds,
                        callsInQueue: ctx.callbackQueue.length,
                        totalCalls: ctx.totalC
                    })
                    resolve()
                })
        } else if (ctx.mC >= ctx.mLim) {
            let d = new Date().getSeconds();
            let seconds = 60 - d;
            ctx.startWaitingCallback({
                currentCallsInAMinute: ctx.mC,
                minutelyLimit: ctx.mLim,
                secondsToWaitTilNextMinute: seconds
            })
            seconds = ctx.test ? 5 : seconds;
            waitSeconds(seconds, ctx.waitingTickCallback)
                .then(() => {
                    ctx.mC = 0;
                    ctx.endWaitingCallback({
                        secondsWaited: seconds,
                        callsInQueue: ctx.callbackQueue.length,
                        totalCalls: ctx.totalC
                    })
                    resolve()
                })
        }
    })
}

function waitSeconds(seconds, tickCallback) {
    return new Promise(function (resolve) {
        let count = 1;
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

exports.LimitWaiter = LimitWaiter;