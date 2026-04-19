// state-manager.js

class StateManager {
    constructor() {
        this.playerState = {};
        this.epgData = {};
        this.streamData = {};
    }

    setPlayerState(state) {
        this.playerState = { ...this.playerState, ...state };
    }

    getPlayerState() {
        return this.playerState;
    }

    setEpgData(data) {
        this.epgData = { ...this.epgData, ...data };
    }

    getEpgData() {
        return this.epgData;
    }

    setStreamData(data) {
        this.streamData = { ...this.streamData, ...data };
    }

    getStreamData() {
        return this.streamData;
    }
}

// Example usage:
const stateManager = new StateManager();

// Update player state
stateManager.setPlayerState({ volume: 50, isPlaying: true });

// Get player state
console.log(stateManager.getPlayerState());

// Update EPG data
stateManager.setEpgData({ channel: 'HBO', program: 'Game of Thrones' });

// Get EPG data
console.log(stateManager.getEpgData());

// Update stream data
stateManager.setStreamData({ url: 'https://example.com/stream', quality: '720p' });

// Get stream data
console.log(stateManager.getStreamData());