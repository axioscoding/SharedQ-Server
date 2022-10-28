module.exports = (app, db, wss, WebSocket) => {
    


    //POST /api/vote
    //Down/Upvote a certain queue item
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

}