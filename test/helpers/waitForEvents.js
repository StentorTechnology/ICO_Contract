module.exports = async function (eventsArray, numEvents) {
    if (numEvents === 0) {
        return Promise.delay(1000); // Wait a reasonable amount so the caller can know no events fired
    }
    numEvents = numEvents || 1;
    const oldLength = eventsArray.length;
    let numTries = 0;
    const pollForEvents = function () {
        numTries++;
        if (eventsArray.length >= (oldLength + numEvents)) {
            return;
        }
        if (numTries >= 100) {
            if (eventsArray.length === 0) {
                console.log('Timed out waiting for events!');
            }
            return;
        }
        return Promise.delay(50)
            .then(pollForEvents);
    };
    return pollForEvents();
};