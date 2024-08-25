import {Ableton} from "ableton-js";
import {WebSocketServer} from "ws";
import express from "express";

const ableton = new Ableton({logger: console});
const wss = new WebSocketServer({port: 8080});
const app = express();

let isPlaying = false;
let currentTempo = -1;
let currentTime = -1;
let fullCues = [];
let serializedSongs = [];
let currentSongId = null;
let currentSectionId = null;
let nextSectionIndex = -1;
let nextSongIndex = -1;
let currentSongProgress = 0;

const broadcast = (message) => {
    wss.clients.forEach((client) => {
        try {
            if (client.readyState === client.OPEN) {
                client.send(JSON.stringify(message));
            } else {
                console.log("Client not in OPEN state");
            }
        } catch (error) {
            console.error("Error sending message to client:", error);
        }
    });
};

const stopPlayback = async () => {
    try {
        await ableton.song.stopPlaying();
        return {success: true};
    } catch (error) {
        console.error("Error stopping playback:", error);
        return {success: false, error: "Failed stopping playback"};
    }
};

const startPlayback = async () => {
    try {
        await ableton.song.startPlaying();
        return {success: true};
    } catch (error) {
        console.error("Error starting playback:", error);
        return {success: false, error: "Failed starting playback"};
    }
};

const jumpToCue = async (cueId) => {
    try {
        const cueToJump = fullCues.find((cue) => cue.raw.id === cueId);

        if (!cueToJump) {
            console.error(`Cue with ID ${cueId} not found`);
            return {success: false, error: `Cue with ID ${cueId} not found`};
        }

        await cueToJump.jump();
        return {success: true};
    } catch (error) {
        console.error("Error jumping to cue:", error);
        return {success: false, error: "Failed to jump to cue"};
    }
};

const checkCurrentSectionId = () => {
    try {
        const currentSong = serializedSongs.find(
            song => song.start.id === currentSongId
        );

        if (!currentSong) {
            console.error("Current song not found in serializedSongs");
            return currentSectionId;
        }

        const currentSection = currentSong.cues.find(
            (section, index) =>
                currentTime >= section.time &&
                (index === currentSong.cues.length - 1 || currentTime < currentSong.cues[index + 1].time)
        );

        if (currentSection) {
            nextSectionIndex = currentSong.cues.findIndex(
                section => section.id === currentSection.id
            ) + 1;
            return currentSection.id;
        } else {
            console.error("No section found for the current time");
            return currentSectionId;
        }
    } catch (error) {
        console.error("Error in checkCurrentSectionId:", error);
        return currentSectionId;
    }
};

const checkCurrentSongId = () => {
    try {
        const currentSong = serializedSongs.find(
            (song) => currentTime >= song.start.time && currentTime <= song.end.time
        );

        if (currentSong) {
            nextSongIndex = serializedSongs.findIndex(
                (song) => song.start.id === currentSong.start.id
            ) + 1;
            return currentSong.start.id;
        } else {
            console.error("No song found for the current time");
            return currentSongId;
        }
    } catch (error) {
        console.error("Error in checkCurrentSongId:", error);
        return currentSongId;
    }
};

const didSongEnd = () => {
    try {
        const currentSong = serializedSongs.find(
            (song) => song.start.id === currentSongId
        );
        return currentTime === currentSong.end.time;
    } catch (error) {
        console.error("Error in didSongEnd:", error);
        return false;
    }
};

const calculateSectionProgress = () => {
    try {
        const currentSong = serializedSongs.find(
            (song) => song.start.id === currentSongId
        );

        if (currentSong) {
            const currentSection = currentSong.cues.find(
                (section) => section.id === currentSectionId
            );

            const nextSection = currentSong.cues[nextSectionIndex];

            if (currentSection) {
                const sectionStartTime = currentSection.time;
                const sectionEndTime = nextSection ? nextSection.time : currentSong.end.time;
                const sectionDuration = sectionEndTime - sectionStartTime;
                const timeElapsed = currentTime - sectionStartTime;

                if (sectionDuration > 0) {
                    return (timeElapsed / sectionDuration) * 100;
                }
            }
        }

        return 0;
    } catch (error) {
        console.error("Error calculating section progress:", error);
        return 0;
    }
};

const calculateSongProgress = () => {
    try {
        const currentSong = serializedSongs.find(
            (song) => song.start.id === currentSongId
        );

        if (currentSong) {
            const {start, end} = currentSong;
            const songDuration = end.time - start.time;
            const timeElapsed = currentTime - start.time;

            if (songDuration > 0) {
                currentSongProgress = (timeElapsed / songDuration) * 100;
            } else {
                currentSongProgress = 0;
            }
        } else {
            currentSongProgress = 0;
        }

        return currentSongProgress;
    } catch (error) {
        console.error("Error calculating progress:", error);
        return 0;
    }
};

const serializeCues = (cues) => {
    try {
        const songs = {};
        const sectionCues = {};

        cues.forEach((cue) => {
            const {name, id, time} = cue.raw;

            if (name.includes("<start>")) {
                const songName = name.replace(" <start>", "");
                if (!songs[songName]) {
                    songs[songName] = {start: null, end: null, cues: []};
                }
                songs[songName].start = {id, time};
                sectionCues[songName] = [];
            } else if (name.includes("<end>")) {
                const songName = name.replace(" <end>", "");
                if (!songs[songName]) {
                    songs[songName] = {start: null, end: null, cues: []};
                }
                songs[songName].end = {id, time};
            } else {
                const recentSongName = Object.keys(songs).reverse().find(
                    (songName) => songs[songName].end === null
                );
                if (recentSongName) {
                    if (!sectionCues[recentSongName]) {
                        sectionCues[recentSongName] = [];
                    }
                    sectionCues[recentSongName].push({name, id, time});
                }
            }
        });

        const serializedSongs = Object.keys(songs).map((songName) => {
            const song = songs[songName];
            const songStartTime = song.start ? song.start.time : null;
            const sectionCuesList = sectionCues[songName] || [];

            const countdownCue = songStartTime !== null && sectionCuesList.length > 0
                ? {name: "Countdown", time: song.start.time, id: song.start.id}
                : null;

            return {
                name: songName,
                start: song.start,
                end: song.end,
                stopAtEnd: true,
                cues: countdownCue ? [countdownCue, ...sectionCuesList] : sectionCuesList
            };
        });

        return serializedSongs.filter(song => song.start && song.end);

    } catch (error) {
        console.error("Error in serializeCues:", error);
        return [];
    }
};

const getCues = async () => {
    try {
        return await ableton.song.get("cue_points");
    } catch (error) {
        console.error("Error fetching cues:", error);
        return [];
    }
};

const main = async () => {
    try {
        await ableton.start();

        app.use(express.json());

        wss.on("connection", (ws) => {
            ws.send("Welcome new client!");
        });

        await ableton.song.addListener("is_playing", (playing) => {
            if (playing !== isPlaying) {
                isPlaying = playing;
                broadcast({type: "is_playing", value: isPlaying});
            }
        });

        await ableton.song.addListener("tempo", (tempo) => {
            if (tempo !== currentTempo) {
                currentTempo = tempo;
                broadcast({type: "tempo", value: currentTempo});
            }
        });

        await ableton.song.addListener("current_song_time", async (time) => {
            const newTime = Math.floor(time);
            if (newTime !== currentTime) {
                currentTime = newTime;
                currentSongId = checkCurrentSongId();
                broadcast({type: "current_song_id", value: currentSongId});
                currentSectionId = checkCurrentSectionId();
                broadcast({type: "current_section_id", value: currentSectionId});
                const songProgress = calculateSongProgress();
                const sectionProgress = calculateSectionProgress();
                broadcast({type: "current_song_progress", value: songProgress});
                broadcast({type: "current_section_progress", value: sectionProgress});
                const didEnd = didSongEnd();
                if (didEnd && isPlaying) {
                    if (serializedSongs[nextSongIndex - 1]?.stopAtEnd) {
                        const stopResult = await stopPlayback();
                        if (!stopResult.success) {
                            console.error(stopResult.error);
                        }
                    }
                    if (serializedSongs[nextSongIndex]) {
                        const jumpResult = await jumpToCue(
                            serializedSongs[nextSongIndex].start.id
                        );
                        if (!jumpResult.success) {
                            console.error(jumpResult.error);
                        }
                    } else {
                        await stopPlayback();
                    }
                }
                broadcast({type: "current_song_time", value: currentTime});
            }
        });

        app.get("/cues", async (req, res) => {
            fullCues = await getCues();
            serializedSongs = serializeCues(fullCues);
            if (serializedSongs.length > 0) {
                res.json(serializedSongs);
            } else {
                res.status(404).send("No songs found");
            }
        });

        app.post("/jumpToCue", async (req, res) => {
            const {id} = req.body;
            const result = await jumpToCue(id);

            if (result.success) {
                res.sendStatus(200);
            } else {
                res.status(500).json({error: result.error});
            }
        });

        app.get("/startPlaying", async (req, res) => {
            if (!isPlaying) {
                const result = await startPlayback();
                if (result.success) {
                    res.status(200).send("Started playback");
                } else {
                    res.status(500).json({error: result.error});
                }
            } else {
                res.status(400).send("Playback already running");
            }
        });

        app.post("/reorderSongs", async (req, res) => {
            try {
                const {order} = req.body;

                if (!Array.isArray(order) || order.length === 0) {
                    return res
                        .status(400)
                        .json({error: "Invalid order array provided"});
                }

                const orderMap = new Map(order.map((id, index) => [id, index]));

                const reorderedSongs = serializedSongs
                    .slice()
                    .sort(
                        (a, b) =>
                            orderMap.get(a.start.id) -
                            orderMap.get(b.start.id)
                    );

                if (reorderedSongs.length !== serializedSongs.length) {
                    return res
                        .status(400)
                        .json({error: "Order array does not match all songs"});
                }

                serializedSongs = reorderedSongs;

                res.status(200).json({message: "Songs reordered successfully"});
            } catch (error) {
                console.error("Error in reorderSongs:", error);
                res.status(500).json({error: "Failed to reorder songs"});
            }
        });

        app.get("/stopPlaying", async (req, res) => {
            if (isPlaying) {
                const result = await stopPlayback();
                if (result.success) {
                    res.status(200).send("Stopped playback");
                } else {
                    res.status(500).json({error: result.error});
                }
            } else {
                res.status(400).send("Playback already stopped");
            }
        });

        app.listen(3001, () => {
            console.log("REST API server started on port 3000");
        });

        console.log("WebSocket server started on port 8080");
    } catch (error) {
        console.error("Error in main function:", error);
    }
};

main();
