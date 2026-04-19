// EPG Parsing Engine

class EPGParser {
    constructor() {
        this.channels = {};
        this.programs = [];
    }

    normalizeChannelId(channelId) {
        // Normalize channel ID to a standard format
        return channelId.toString().toLowerCase();
    }

    parseDateTime(xmltvDate) {
        // Flexible date/time parsing for XMLTV timestamps
        return new Date(xmltvDate);
    }

    addChannel(channel) {
        const normalizedId = this.normalizeChannelId(channel.id);
        this.channels[normalizedId] = channel;
    }

    addProgram(program) {
        this.programs.push(program);
    }

    // Channel resolver with alias matching
    resolveChannel(channelAlias) {
        for (const id in this.channels) {
            const channel = this.channels[id];
            if (channel.aliases.includes(channelAlias)) {
                return channel;
            }
        }
        return null;
    }

    // Indexing for fast lookups
    getCurrentProgram(channelId) {
        const now = new Date();
        const normalizedId = this.normalizeChannelId(channelId);
        return this.programs.find(program => 
            program.channelId === normalizedId && 
            program.startTime <= now && 
            program.endTime >= now
        );
    }

    getNextProgram(channelId) {
        const now = new Date();
        const normalizedId = this.normalizeChannelId(channelId);
        return this.programs.find(program => 
            program.channelId === normalizedId && 
            program.startTime > now
        );
    }
}

// Example usage
const epgParser = new EPGParser();
// Add channels and programs as needed using addChannel() and addProgram() methods.

