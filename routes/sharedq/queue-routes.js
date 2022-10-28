const axios = require("axios");
const {calcNextSong, addNextSongToSpotify} = require("../../common/functions")

module.exports = (app, db, wss, WebSocket) => {


    //POST /api/queue/add
    //Create a new queue item in the queue
    app.post("/api/queue/add", async (req, res) => {
        console.log("/api/queue/add")
        const {session_id, song_id, id} = req.body


        db.query(`SELECT queue, next_song, spotify_auth_token FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
            if(error){
                console.log(error.stack)
                res.status(500).json({error: "Database error"})
            }else{
                if(result.rowCount > 0){
                    let {queue, next_song, spotify_auth_token} = result.rows[0]

                    const config = {
                        headers: { Authorization: `Bearer ${spotify_auth_token}` }
                    };
                    axios.get(`https://api.spotify.com/v1/tracks/${song_id}`, config).then(response => {
                        console.log(response.data)
                        const track = response.data
                        const downvoted = {}
                        downvoted[id] = false
                        const upvoted = {}
                        upvoted[id] = false
                        const newQueueItem = {
                            uri: track.uri,
                            name: track.name,
                            artist: track.artists[0].name,
                            img: track.album.images[0].url,
                            duration_ms: track.duration_ms,
                            song_id: track.id,
                            votes: 0,
                            upvoted,
                            downvoted
                        }


                        if(queue === undefined || queue === null || !Array.isArray(queue)){
                            queue = []
                        }

                        if(queue.some(e => e.uri === track.uri)){
                            console.log("exists")
                            res.status(400).json({error: "Song already exists", error_code: 0})
                        }else{
                            queue.push(newQueueItem)
                            queue = queue.sort((a, b) => {
                                return b.votes - a.votes
                            })


                            //Add song to queue if the next song is undefined
                            if(next_song === undefined || next_song === null){
                                const {newQueue, newNextSong} = calcNextSong(queue)
                                queue = newQueue
                                const queueString = JSON.stringify(queue)
                                const nextSongString = JSON.stringify(newNextSong)
                                const text = "UPDATE sessions SET queue = $1, next_song = $2 WHERE session_id = $3"
                                const values = [queueString, nextSongString, session_id]
    
                                db.query(text, values, (error2, result2) => {
                                    if(error2){
                                        console.log(error2.stack)
                                        res.status(500).json({error: "Database error"})
                                    }else{
                                        addNextSongToSpotify(newNextSong.uri, spotify_auth_token, wss, WebSocket)
                                        console.log("SOCKET")
                                        wss.clients.forEach(client => {
                                            if(client.readyState === WebSocket.OPEN){
                                                client.send(JSON.stringify({update: true}))
                                            }
                                        })
                                        res.status(200).json({song_uri: track.uri})
                                    }
                                })
                            }else{
                                const queueString = JSON.stringify(queue)
                                const text = "UPDATE sessions SET queue = $1 WHERE session_id = $2"
                                const values = [queueString, session_id]
    
                                db.query(text, values, (error2, result2) => {
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
                                        res.status(200).json({song_uri: track.uri})
                                    }
                                })
                            }
                            
                        }

                    }).catch(err => {
                        console.log("ERRRRR")
                        console.log(err)
                        console.log(err.response)
                        res.status(400).json({error: "Spotify error"})
                    })
                        
    
                    
                }else{
                    console.log("missing queue")
                    res.status(400).json({error: "missing queue"})
                }
            }
        })
    
    })


    
    //DELETE /api/queue
    //Delete the queue
    app.delete("/api/queue", async (req, res) => {
        console.log("DELETE /api/queue")
    })
    
    //GET /api/queue
    //Get the queue
    app.get("/api/queue", (req, res) => {
        console.log("GET /api/queue")
        if(req.query.session_id === undefined || req.query.session_id === null){
            res.status(400).json({error: "Missing session"})
        }else{
            const session_id = req.query.session_id
    
            db.query(`SELECT queue FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
                if(error){
                    res.status(500).json({error: "Database error"})
                }else{
                    if(result.rowCount > 0){
                        let {queue} = result.rows[0]
                        
                        if((queue !== undefined && queue !== null)){
                            res.status(200).json({queue})
                        }else{
                            res.status(200).json({queue: []})
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
