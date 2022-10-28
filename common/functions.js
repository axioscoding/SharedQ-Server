const axios = require("axios");

const calcNextSong = (queue) => {
    const max_votes = queue.reduce((a,b) => a.votes>b.votes?a:b)
    queue = queue.filter(e => {return e.uri !== max_votes.uri})

    return {newQueue: queue, newNextSong: max_votes}
}

const addNextSongToSpotify = (uri, spotify_auth_token, wss, WebSocket) => {

    const config = {
        headers: { Authorization: `Bearer ${spotify_auth_token}` }
    };

    const body = {
        uri
    }

    axios.post("https://api.spotify.com/v1/me/player/queue?" + new URLSearchParams(body), {}, config).then(res => {
        console.log("Added song to queue")
        wss.clients.forEach(client => {
            if(client.readyState === WebSocket.OPEN){
                client.send(JSON.stringify({update: true}))
            }
        })
        return true
    }).catch(err => {
        console.log("added song error:")
        console.log(err)
        return false
    })


}


const newAuthToken = () => {

}


module.exports = {
    calcNextSong,
    addNextSongToSpotify
}