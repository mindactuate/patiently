const patiently = require("./index.js");

let optionsTest1 = {
    startWaitingCallback: function (info) { console.log("start waiting", info) },
    endWaitingCallback: function (info) { console.log("end waiting", info) },
    waitingTickCallback: function (info) { console.log("tick", info) },
    msBetweenTwoCalls: 1000,
    minutelyLimit: 5,
    hourlyLimit: 10,
    test: true
}
let limitWaiter = new patiently.LimitWaiter(optionsTest1);

let test1 = async (callNumber) => {
    console.log("#" + callNumber + ": test start")
    for (let i = 1; i <= 6; i++) {
        limitWaiter.wait(function () {
            console.log("#" + callNumber + ": api call", i);
        })
    }
}

let testRoutines = async () => {
    console.log();
    console.log("######## test 1 ########")
    console.log();
    test1(1)
    test1(2)
    test1(3)
    test1(4)
    test1(5)
}

testRoutines();