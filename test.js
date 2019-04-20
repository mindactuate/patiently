const coffeebreak = require("./index.js");

let optionsTest1 = {
    startWaitingCallback: function (info) { console.log("start waiting", info) },
    endWaitingCallback: function (info) { console.log("end waiting", info) },
    waitingTickCallback: function (info) { console.log("tick", info) },
    minutelyLimit: 5,
    hourlyLimit: 10 // reduce to below 6 if its like 5 minutes before a new hour, otherwise you will wait til new hour begins
}
let limitWaiter = new coffeebreak.LimitWaiter(optionsTest1);

let test1 = async () => {
    for (let i = 1; i <= 6; i++) {
        console.log();
        console.log("/// check limits");
        await limitWaiter.checkLimits()
            .then(info => { console.log("checked", info) })
        console.log("/// continue with your api call")
    }
}

let optionsTest2 = {
    startWaitingCallback: function (info) { console.log("start waiting", info) },
    endWaitingCallback: function (info) { console.log("end waiting", info) },
    waitingTickCallback: function (info) { console.log("tick", info) },
    limitHeaderName: "x-ratelimit-limit",
    remainHeaderName: "x-ratelimit-remaining",
    resetHeaderName: "x-ratelimit-reset",
    resetHeaderType: coffeebreak.ResetHeaderType.UNIXEPOCHTIMEINSECONDS
}
let xRateLimitWaiter = new coffeebreak.XRateLimitWaiter(optionsTest2);

let test2 = async () => {
    for (let i = 1; i <= 6; i++) {
        console.log();
        console.log("/// check limits");
        await xRateLimitWaiter.checkLimits()
            .then(info => { console.log("checked", info) })
            .catch(err => { console.log("error", err) })
        console.log("/// continue with your api call");
        await apiCallSimulator(2)
            .then(() => {
                let fakeHeaders = {
                    "x-ratelimit-limit": 5,
                    "x-ratelimit-remaining": i === 6 ? 4 : 5 - i,
                    "x-ratelimit-reset": Math.ceil(new Date().getTime() / 1000) + 3
                }
                xRateLimitWaiter.updateLimits(fakeHeaders);
            })
    }
}

function apiCallSimulator(delayInSeconds) {
    return new Promise(function (resolve) {
        let count = 0;
        let v = setInterval(function () {
            count++;
            if (count > delayInSeconds) {
                clearInterval(v);
                resolve();
            }
        }, 1000)
    })
}

let testRoutines = async () => {
    console.log();
    console.log("######## test 1 ########")
    console.log();
    await test1();

    console.log();
    console.log("######## test 2 ########")
    console.log();
    await test2();
}

testRoutines();