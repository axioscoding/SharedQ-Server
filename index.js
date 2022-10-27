const axios = require("axios")
const nanoid = require("nanoid")
const db = require("./db")


const WSServer = require("ws").Server
const {WebSocket} = require("ws")
const server = require("http").createServer()
const app = require("./express-server")

const QRCode = require("qrcode")

const wss = new WSServer({server: server});
server.on('request', app);
  

const client_id = "69d25c690d5b4a00ab63d45e015b5567";
const client_secret = "3423c76717d44543bf75897cf919fde4";
const redirect_uri = "http://192.168.178.34:3000/queue";
const BASE_URL = "http://192.168.178.34:3001"


wss.on('connection', function connection(ws) {
 
    ws.on('message', function incoming(message) {
      
      console.log(`received: ${message}`);
      
      ws.send(JSON.stringify({
  
        pong: true
      }));
    });
});



app.post("/api/token", async (req, res) => {
    console.log("POST /api/token")
    const body = {
        grant_type: "authorization_code",
        code: req.body.code,
        redirect_uri
    };

    
    axios.post("https://accounts.spotify.com/api/token", new URLSearchParams(body), {headers:{'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')}}).then(response => { 
        res.status(200).json(response.data)
    }).catch(err => {
        console.log(err);
        res.status(400).json("failed")
    })

})


app.post("/api/refresh", async (req, res) => {
    console.log("POST /api/refresh")
    console.log(req.body)

    if(req.body.session_id === undefined || req.body.session_id === null){
        res.status(400).json({error: "invalid session"})
    }
    db.query(`SELECT spotify_auth_token, spotify_refresh_token FROM sessions WHERE session_id = '${req.body.session_id}';`, (error, response) => {
        if(error){
            res.status(500).json({error: "Database error"})
        }else{
            if(response.rowCount > 0){
                const {spotify_auth_token, spotify_refresh_token} = response.rows[0]
                console.log("TOKEN:")
                console.log(spotify_refresh_token)
                const body = {
                    grant_type: "refresh_token",
                    refresh_token: spotify_refresh_token
                }
                axios.post("https://accounts.spotify.com/api/token", new URLSearchParams(body), {headers:{'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')}}).then(response2 => {
                    db.query(`UPDATE sessions SET spotify_auth_token = '${response2.data.access_token}' WHERE session_id = '${req.body.session_id}';`, (error, result) => {
                        if(error){
                            console.log(error)
                            console.log("REFRESH DB ERROR")
                            res.status(500).json({error: "Server error"})
                        }else{
                            console.log("REFRESH SUCCESS")
                            res.status(200).json({access_token: response2.data.access_token})
                        }
                    })
                    
                }).catch(err => {
                    console.log("REFRESH SPOTIFY ERROR")
                    console.log(err)
                    res.status(400).json({error: "Bad request"})
                })
            
                
            }else{
                res.status(400).json({error: "Invalid session"})
            }
        }
    })


    
})

app.post("/api/session", async (req, res) => {
    console.log("POST /api/session")
    console.log(req.body)
    console.log("SESSION")

    const id = nanoid.customAlphabet("0123456789", 6)()
    const toEncode = "http://192.168.178.34:3000/queue/" + id

    QRCode.toDataURL(toEncode, (err, url) => {
        if(err){
            const text = `INSERT INTO sessions(session_id, spotify_auth_token, spotify_refresh_token, time_created) VALUES($1, $2, $3, now());`
            const values = [id, req.body.auth_token, req.body.refresh_token]

            db.query(text, values, (err, response) => {
                if(err){
                    console.log(err.stack)
                    res.status(500).json({error: "Database error"})
                }else{
                    res.status(200).json({session_id: id})
                }   
            })
        }else{
            const text = `INSERT INTO sessions(session_id, spotify_auth_token, spotify_refresh_token, time_created, qrcode) VALUES($1, $2, $3, now(), $4);`
            const values = [id, req.body.auth_token, req.body.refresh_token, url]

            db.query(text, values, (err, response) => {
                if(err){
                    console.log(err.stack)
                    res.status(500).json({error: "Database error"})
                }else{
                    res.status(200).json({session_id: id})
                }   
            })
        }
    })

    


})


app.get("/api/search", async (req, res) => {
    console.log("GET /api/search")
    if(req.query.session_id === undefined || req.query.session_id === null){
        res.status(400).json({error: "invalid session"})
    }
    db.query(`SELECT spotify_auth_token, spotify_refresh_token FROM sessions WHERE session_id = '${req.query.session_id}';`, (error, response) => {
        if(error){
            res.status(500).json({error: "Database error"})
        }else{
            if(response.rowCount > 0){
                const {spotify_auth_token, spotify_refresh_token} = response.rows[0]

                let {query} = req.query

                let config = {
                    headers: { Authorization: `Bearer ${spotify_auth_token}` }
                };
                axios.get("https://api.spotify.com/v1/search?" + new URLSearchParams({q: query, type: "track"}), config).then(result => {
                    res.status(200).json(result.data.tracks)
                }).catch(err => {
                    console.log("ERR1")
                    console.log(err)
                    if(err.response){
                        if(err.response.status === 401){
                            console.log("AUTH EXP")
                            res.status(401).json({error: "Authorization expired"})
                        }else{
                            console.log("ERR2")
                            res.status(400).json({error: "Bad Request"})
                        }
                    }else{
                        console.log("ERR3")
                        res.status(500).json({error: "Server error"})
                    }
                })



            }else{
                res.status(400).json({error: "Invalid session"})
            }
        }
    })
})


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


app.get("/api/songs", (req, res) => {
    console.log("GET /api/songs")
    const {session_id, ids} = req.query

    db.query(`SELECT spotify_auth_token FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
        if(error){
            res.status(500).json({error: "Database error"})
        }else{
            if(result.rowCount > 0){
                const {spotify_auth_token} = result.rows[0]
                const config = {
                    headers: { Authorization: `Bearer ${spotify_auth_token}` }
                };
                axios.get("https://api.spotify.com/v1/tracks?" + ids, config).then(res => {
                    res.status(200).json(res.data)
                }).catch(err => {
                    res.status(400).json({error: "Spotify error"})
                })
            }else{
                res.status(400).json({error: "Invalid session"})
            }
        }
    })

    
})

app.post("/api/vote", (req, res) => {
    console.log("POST /api/vote")
    const {session_id, song_id, amount, id, vote_state} = req.body
    console.log(req.body)
    db.query(`SELECT queue FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
        if(error){
            res.status(500).json({error: "Database error"})
        }else{
            if(result.rowCount > 0){
                let {queue} = result.rows[0]
                const index = queue.findIndex(elem => elem.song_id === song_id)
                if(index === null){
                    res.status(400).json({error: "Bad request"})
                }else{
                    const id_string = id.toString()
                    console.log("VOTE_STATE")
                    console.log(vote_state)
                    if(vote_state){
                        if(queue[index].upvoted[id_string]){
                            queue[index].upvoted[id_string] = false
                            queue[index].votes--
                        }else if(queue[index].downvoted[id_string]){
                            queue[index].upvoted[id_string] = true
                            queue[index].downvoted[id_string] = false
                            queue[index].votes += 2
                        }else{
                            queue[index].upvoted[id_string] = true
                            queue[index].votes++
                        }
                    }else{
                        if(queue[index].downvoted[id_string]){
                            queue[index].downvoted[id_string] = false
                            queue[index].votes++
                        }else if(queue[index].upvoted[id_string]){
                            queue[index].upvoted[id_string] = false
                            queue[index].downvoted[id_string] = true
                            queue[index].votes -= 2
                        }else{
                            queue[index].downvoted[id_string] = true
                            queue[index].votes--
                        }
                    }

                    console.log(vote_state)
                    console.log(queue[index])
                    console.log(queue[index].upvoted[id_string])
                    console.log(queue)
                    console.log("VOOOOOTTTEEE")
                    queue = queue.sort((a, b) => {
                        return b.votes - a.votes
                    })
                    console.log("SORT")
                    console.log(queue)
                    const text = "UPDATE sessions SET queue = $1 WHERE session_id = $2;"
                    const values = [JSON.stringify(queue), session_id]
                    db.query(text, values, (error2, result2) => {
                        if(error2){
                            res.status(500).json({error: "Database error"})
                        }else{
                            wss.clients.forEach(client => {
                                if(client.readyState === WebSocket.OPEN){
                                    client.send(JSON.stringify({update: true}))
                                }
                            })
                            res.status(200).json({song_id})
                        }   
                    })
                }
            }else{
                res.status(400).json({error: "Invalid session"})
            }
        }
    })
})

const pollSongStatus = () => {
    console.log("POLL")
    
    db.query("SELECT session_id, spotify_auth_token, spotify_refresh_token, time_created, queue, next_song FROM sessions;", (error, result) => {
        if(error){
            console.log(error.stack)
            console.log("ERRORRRR")
        }
        const sessions = []
        for(let i = 0; i < result.rows.length; i++){
            const day= 1000 * 60 * 60 * 24;
            if((Date.now() - day) > result.rows[i].time_created){
                continue
            }else{
                sessions.push(result.rows[i])
            }
        }
        
        sessions.forEach(session => {
            console.log("lsihf")
            const config = {
                headers: { Authorization: `Bearer ${session.spotify_auth_token}` }
            };
            if((session.queue !== undefined && session.queue !== null)){
                
                axios.get("https://api.spotify.com/v1/me/player/queue", config).then(res => {
                    const {currently_playing} = res.data
                    const spotify_queue = res.data.queue
                    
                    if(spotify_queue.filter(elem => elem.id === session.next_song).length === 0){
                        console.log("YES2")
                        //NEXT SONG
                        if(session.queue.length > 0){
                            let nextsong = session.queue.reduce((max, song) => max.votes > song.votes ? max : song)
                            if(nextsong.votes === 0) nextsong = session.queue[0]
                            let newQueue = session.queue.filter(elem => elem.song_id !== nextsong.song_id)
                            newQueue = newQueue.sort((a, b) => {
                                a.votes - b.votes
                            })
                            const newNextSong = nextsong.song_id
                            if(newQueue.length === 0) newQueue = null
                            console.log("UPDATE")
                            const text = "UPDATE sessions SET queue = $1, next_song = $2, next_song_upvotes = $4 WHERE session_id = $3;"
                            const values = [JSON.stringify(newQueue), newNextSong, session.session_id, nextsong.votes]
                            db.query(text, values, (error2, result2) => {
                                if(error2){
                                    console.log("ERROR2")
                                    console.log(error2.stack)
                                }else{

                                    axios.post("https://api.spotify.com/v1/me/player/queue?uri="+nextsong.uri, {}, config).then(res2 => {
                                        wss.clients.forEach(client => {
                                            if(client.readyState === WebSocket.OPEN){
                                                client.send(JSON.stringify({update: true}))
                                            }
                                        })
                                        console.log("YES")
                                    }).catch(err2 => {
                                        console.log(err2.response)
                                    })

                                }
                            })
                        }else{
                            //remove next song
                            console.log("remove next song")
                            console.log(session.next_song)
                            if(session.next_song !== undefined && session.next_song !== null){
                                const text = "UPDATE sessions SET next_song = $1 WHERE session_id = $2;"
                                const values = [null, session.session_id]
                                db.query(text, values, (error2, result2) => {
                                    if(error2){
                                        console.log(error2.stack)
                                    }else{
                                        console.log("next song cleared")
                                    }
                                })
                            }
                        }
                    }else{
                        console.log("IN QUEUE")
                    }
                    

                }).catch(err => {
                    console.log(err)
                    if(err.response){
                        if(err.response.status === 401){
                            const body = {
                                grant_type: "refresh_token",
                                refresh_token: session.spotify_refresh_token
                            }
                            axios.post("https://accounts.spotify.com/api/token", new URLSearchParams(body), {headers:{'Content-Type': 'application/x-www-form-urlencoded',
                            'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')}}).then(response2 => {
                                db.query(`UPDATE sessions SET spotify_auth_token = '${response2.data.access_token}' WHERE session_id = '${session.session_id}';`, (error, result) => {
                                    if(error){
                                        console.log("error1")
                                    }else{
                                        console.log("error2")
                                        pollSongStatus()
                                    }
                                })
                                
                            }).catch(err => {
                                console.log("error13")
                            })
                        }
                    }else{
                        console.log(err)
                    }
                    
                })
            }else if(session.next_song !== undefined && session.next_song !== null){
                //remove next song
                console.log("remove next song")
                console.log(session.next_song)
                if(session.next_song !== undefined && session.next_song !== null){
                    const text = "UPDATE sessions SET next_song = $1 WHERE session_id = $2;"
                    const values = [null, session.session_id]
                    db.query(text, values, (error2, result2) => {
                        if(error2){
                            console.log(error2.stack)
                        }else{
                            console.log("next song cleared")
                        }
                    })
                }
            }
        })
        
    })
}

app.get("/api/test", (req, res) => {
    console.log("GET /api/test")
    console.log("test")
    res.status(200).json("ok")
})



app.get("/api/qrcode", (req, res) => {
    const {session_id} = req.query
    const toEncode = "http://192.168.178.34:3000/queue/" + session_id

    QRCode.toDataURL(toEncode, (err, url) => {
        if(err){
            console.log(err)
            res.status(500).json({error: "server error"})
        }else{
            console.log(url)
            res.status(200).json({url})
        }
    })
})


setInterval(() => {
    pollSongStatus()
}, 30000)


pollSongStatus()




server.listen(3001, "192.168.178.34", () => {console.log("listening on 3001")})
