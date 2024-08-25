# Ableton Setlist Server

This project sets up a control server that interacts with Ableton Live, allowing for real-time control and monitoring of playback, song progress, and cue points through a WebSocket server and REST API. The server can be used to remotely start/stop playback, jump to specific cues, reorder songs, and retrieve information about the current state of the Ableton session.

## Features

- **Real-Time Playback Control**: Start and stop playback in Ableton Live.
- **Cue Management**: Retrieve, jump to, and reorder song cues.
- **Song and Section Progress Tracking**: Monitor the progress of the current song and section in real-time.
- **WebSocket Server**: Broadcasts updates on playback status, current song, section, and progress to connected clients.
- **REST API**: Endpoints for interacting with Ableton Live, including cue retrieval, playback control, and song reordering.

## Prerequisites

- **Node.js**: Make sure you have Node.js installed. You can download it from [here](https://nodejs.org/).
- **Ableton Live**: Ensure you have Ableton Live installed and running.
- **Properly adjusted Ableton Live Set**: Song start cues need to include `<start>` and end cues need to include `<end>` in their names

## Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/joohnnyvv/ableton-setlist-manager-server.git
   cd ableton-setlist-manager-server
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run the Server**
   ```bash
   node index.js
   ```

   The WebSocket server will start on port `8080`, and the REST API will start on port `3001`.

## Usage

### WebSocket Server

The WebSocket server broadcasts the following messages to all connected clients:

- **is_playing**: Indicates whether Ableton Live is currently playing.
- **tempo**: Current tempo of the Ableton session.
- **current_song_time**: Current time within the playing song.
- **current_song_id**: ID of the current song.
- **current_section_id**: ID of the current section within the song.
- **current_song_progress**: Progress of the current song as a percentage.
- **current_section_progress**: Progress of the current section as a percentage.

### REST API

#### 1. Get Cues
   ```bash
   GET /cues
   ```
Retrieves a list of all songs and their cues from the Ableton session.

#### 2. Start Playback
   ```bash
   GET /startPlaying
   ```
Starts playback in Ableton Live.

#### 3. Stop Playback
   ```bash
   GET /stopPlaying
   ```
Stops playback in Ableton Live.

#### 4. Jump to Cue
   ```bash
   POST /jumpToCue
   ```
Jumps to a specific cue by its ID.
- **Request Body**:
  ```json
  {
    "id": "cue-id"
  }
  ```

#### 5. Reorder Songs
   ```bash
   POST /reorderSongs
   ```
Reorders songs based on the provided order of cue IDs.
- **Request Body**:
  ```json
  {
    "order": ["cue-id1", "cue-id2", "cue-id3"]
  }
  ```

## Error Handling

The server provides error messages and status codes for various scenarios, such as when a cue is not found or if playback control commands fail.

## Logs

- The server logs playback changes, errors, and other significant events to the console for debugging purposes.

## License

This project is licensed under the MIT License.

## Acknowledgments

- This project uses the [ableton-js](https://www.npmjs.com/package/ableton-js) library for interacting with Ableton Live.
- The WebSocket server is powered by the [ws](https://www.npmjs.com/package/ws) library.
- The REST API is built using [Express.js](https://expressjs.com/).
