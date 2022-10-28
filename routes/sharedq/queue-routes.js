const axios = require("axios");

module.exports = (app, db, wss, WebSocket) => {
    app.post("/api/queue", async (req, res) => {
        console.log("POST /api/queue")
        const {session_id, song_uri, song_id, name, artist, id} = req.body
    
        db.query(`SELECT queue FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
            if(error){
                console.log(error.stack)
                res.status(500).json({error: "Database error"})
            }else{
                if(result.rowCount > 0){
                    let queue = result.rows[0].queue
                    console.log(queue)
                    console.log("kdlshfköledfhg")
                    if(queue === null || queue === {}){
                        const downvoted = {}
                        downvoted[id] = false
                        const upvoted = {}
                        upvoted[id] = false
                        const newQueueItem = {uri: song_uri, song_id, name, artist, votes: 0, upvoted, downvoted}
                        queue = []
                        queue.push(newQueueItem)
                        const queueString = JSON.stringify(queue)
                        console.log("HALLLOOOOO")
                        console.log(queueString)
                        console.log("SOCKET2")
                        db.query(`UPDATE sessions SET queue = '${queueString}' WHERE session_id = '${session_id}'`, (error2, result2) => {
                            if(error2){
                                console.log(error2.stack)
                                res.status(500).json({error: "Database error"})
                            }else{
                                console.log("SOCKET")
                                wss.clients.forEach(client => {
                                    if(client.readyState === WebSocket.OPEN){
                                        client.send(JSON.stringify({update: true}))
                                    }
                                })
                                res.status(200).json({song_uri})
                            }
                        })
                    }else{
                        if(queue.some(e => e.uri === song_uri)){
                            console.log("exists")
                            res.status(400).json({error: "Song already exists", error_code: 0})
                        }else{
                            console.log("lkdhfglödhg")
                            const downvoted = {}
                            downvoted[id] = false
                            const upvoted = {}
                            upvoted[id] = false
                            const newQueueItem = {uri: song_uri, song_id, name, artist, votes: 0, upvoted, downvoted}
                            queue.push(newQueueItem)
                            queue = queue.sort((a, b) => {
                                return b.votes - a.votes
                            })
                            const queueString = JSON.stringify(queue)
                            console.log(queueString)
                            db.query(`UPDATE sessions SET queue = '${queueString}' WHERE session_id = '${session_id}'`, (error2, result2) => {
                                if(error2){
                                    console.log(error2.stack)
                                    res.status(500).json({error: "Database error"})
                                }else{
                                    console.log("SOCKET")
                                    wss.clients.forEach(client => {
                                        if(client.readyState === WebSocket.OPEN){
                                            client.send(JSON.stringify({update: true}))
                                        }
                                    })
                                    res.status(200).json({song_uri})
                                }
                            })
                        }
                    }
                        
    
                    
                }
            }
        })
    
    })
    
    app.delete("/api/queue", async (req, res) => {
        console.log("DELETE /api/queue")
    })
    
    
    app.get("/api/queue", (req, res) => {
        console.log("GET /api/queue")
        if(req.query.session_id === undefined || req.query.session_id === null){
            res.status(400).json({error: "Missing session"})
        }else{
            const session_id = req.query.session_id
    
            db.query(`SELECT queue, next_song, spotify_auth_token, next_song_upvotes, qrcode FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
                if(error){
                    res.status(500).json({error: "Database error"})
                }else{
                    if(result.rowCount > 0){
                        let {queue, next_song, spotify_auth_token, next_song_upvotes, qrcode} = result.rows[0]
                        
                        console.log(queue, next_song)
                        if(!((queue === undefined || queue === null) && (next_song === undefined || next_song === null))){
                            let song_string = "ids="
                            if(queue !== undefined && queue !== null){
                                queue.forEach(element => {
                                    song_string += element.song_id
                                    song_string += ","
                                });
                            }
                            
                            song_string += next_song
                            console.log(song_string)
                            const config = {
                                headers: { Authorization: `Bearer ${spotify_auth_token}` }
                            };
                            axios.get("https://api.spotify.com/v1/tracks?" + song_string, config).then(response => {
                                const {tracks} = response.data
                                const queue2 = []
                                for(let i = 0; i < tracks.length - 1; i++){
                                    queue2.push({
                                        uri: tracks[i].uri,
                                        name: tracks[i].name,
                                        artist: tracks[i].artists[0].name,
                                        img: tracks[i].album.images[0].url,
                                        duration_ms: tracks[i].duration_ms,
                                        song_id: tracks[i].id,
                                        votes: queue[i].votes,
                                        upvoted: queue[i].upvoted,
                                        downvoted: queue[i].downvoted
                                    })
                                }
    
                                const next_song2 = {
                                    uri: tracks[tracks.length-1].uri,
                                    name: tracks[tracks.length-1].name,
                                    artist: tracks[tracks.length-1].artists[0].name,
                                    img: tracks[tracks.length-1].album.images[0].url,
                                    duration_ms: tracks[tracks.length-1].duration_ms,
                                    song_id: tracks[tracks.length-1].id,
                                    votes: next_song_upvotes
                                }
                                res.status(200).json({queue: queue2, next_song: next_song2, qrcode})
                            }).catch(err => {
                                console.log(err.response)
                                res.status(400).json({error: "Spotify error"})
                            })
    
                        }else{
                            res.status(200).json({queue: [], next_song: null, qrcode})
                        }
                    }else{
                        res.status(400).json({error: "Invalid session"})
                    }
                }
            })
        }
    })
    
    app.post("/api/queue/next", (req, res) => {
        console.log("POST /api/queue/next")
        const {session_id} = req.body
        console.log("NEXT SONG")
        console.log(session_id)
        db.query(`SELECT queue, spotify_auth_token FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
            if(error){
                res.status(500).json({error: "Database error"})
            }else{
                if(result.rowCount > 0){
                    let {spotify_auth_token, queue} = result.rows[0]
                    if(queue === undefined || queue === null || queue.length === 0 || queue === {}){
                        res.status(400).json({error: "Empty queue"})
                    }else{
                        const max_votes = queue.reduce((a,b) => a.votes>b.votes?a:b)
                        queue = queue.filter(e => {return e.uri !== max_votes.uri})
                        console.log(max_votes.song_id)
                        console.log(queue)
                        if(queue.length === 0) queue = null
                        const text = "UPDATE sessions SET queue = $1, next_song = $2, next_song_upvotes = $4 WHERE session_id = $3"
                        const values = [queue, max_votes.song_id, session_id, 0]
                        
                        
                        db.query(text, values, (error2, result2) => {
                            if(error2){
                                res.status(500).json({error: "Database error"})
                            }else{
    
    
                                console.log("SPOTIFY ACTION:")
                                console.log(max_votes)
                                console.log(spotify_auth_token)
    
                                const config = {
                                    headers: { Authorization: `Bearer ${spotify_auth_token}` }
                                };
    
                                const body = {
                                    uri: max_votes.uri
                                }
    
                                axios.post("https://api.spotify.com/v1/me/player/queue?" + new URLSearchParams(body), {}, config).then(res2 => {
                                    console.log("YES!")
                                    wss.clients.forEach(client => {
                                        if(client.readyState === WebSocket.OPEN){
                                            client.send(JSON.stringify({update: true}))
                                        }
                                    })
                                    res.status(200).json({uri: max_votes.song_id})
                                }).catch(err2 => {
                                    console.log(err2.response.data)
                                    if(err2.response.status === 404){
                                        res.status(404).json({error: "No active device"})
                                    }else{
                                        res.status(500).json({error: "Spotify error"})
                                    }
                                    
                                })
    
    
                                
                            }
                        })
    
                        
                    }
                }else{
                    res.status(400).json({error: "Invalid session"})
                }
            }
        })
    })
}