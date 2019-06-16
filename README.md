# patiently
Promise based API rate limit handler. Make your API client patient. A legal way to wait for API rate limit resets.

[![npm version](https://img.shields.io/npm/v/patiently.svg?style=flat-square)](https://www.npmjs.com/package/patiently)
[![install size](https://packagephobia.now.sh/badge?p=patiently)](https://packagephobia.now.sh/result?p=patiently)
[![Downloads](https://badgen.net/npm/dt/patiently)](https://www.npmjs.com/package/patiently)
![license](https://badgen.net/npm/license/patiently)

## Purpose

Sometimes there is no other way to be patient and to wait for the API rate limit to reset. Just think of a personalized API that allows you to perform actions in a specific user context. You want to do like 10.000 reqs as fast as possible. What if there are rate limits like 50 reqs per minute and 750 reqs per hour? And what if those limits are not bound to an IP or a host but to your user? In this case there is no other way but to wait for a limit reset. Of course, you can also politely ask the API owner to increase the limits. But even then you need **patiently**. :)

## Features

- **patiently** will handle API rate limits for you and make your API client wait for a limit reset automatically
- set minutely or hourly rate limits manually

## Planned Features

- [x] Add secondly limit feature (e.g. 2 reqs per second).
- [] If required I can add a "maxConcurrent" feature like in [bottleneck](https://www.npmjs.com/package/bottleneck)
- [] I'm also trying to figure out how to deal with rate limit headers like ```x-ratelimit-remaining``` or ```retry-after```. At first sight this is not so easy, because the first headers only arrive after the first API call. And until then, any number of API calls could have been fired.

## Installing

Using npm:

```bash
$ npm install patiently
```

## How to use

### Use by setting limits manually

Perhaps you already know about the limits (maybe from the API docs).

```javascript
     import patiently from "patiently";

     let options = {
       startWaitingCallback: function(info){console.log(info)}, // default is function(){}, calls a function if waiting necessary
       endWaitingCallback: function(info){console.log(info)}, // default is function(){}, calls a function after waiting
       waitingTickCallback: function(info){console.log(info)}, // default is function(){}, calls a function every tick
       msBetweenTwoCalls: 1000, // default is 0 milliseconds (no waiting time between two calls)
       minutelyLimit: 50, // default is Infinity (no minutely limit set)
       hourlyLimit: 750, // default is Infinity (no hourly limit set)
       test: false // default is false (if true, max waiting time is 5 secs)
     }

     var waiter = patiently.LimitWaiter(options);

     let myApiCallFunction = async () => {
         waiter.wait(function(){
           // your api call
         })
     }

     // you can call myApiCallFunction as often you want
     // patiently can handle asynchronous api calls :)
     myApiCallFunction();
     myApiCallFunction();
     myApiCallFunction();
     myApiCallFunction();
     // ...
 ```

## How does it work?

- Each function you give to the waiter as a parameter is queued in an array
  - ``` F -> E D C B A```

- The longest waiting function is first
  - ``` F E D C B -> A```
- Before the function is called, it is checked whether we have to wait first or not
  - ``` F E D C B -> A (wait?)```
- If yes the queue processing is *paused* and when the waiting time elapsed, function A will be called
  - ``` F E D C B -> A (call)```

## License

MIT
