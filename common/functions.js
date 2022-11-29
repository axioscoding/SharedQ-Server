const axios = require("axios");

const calcNextSong = (queue) => {
    const max_votes = queue.reduce((a,b) => a.votes>b.votes?a:b)
    queue = queue.filter(e => {return e.uri !== max_votes.uri})

    return {newQueue: queue, newNextSong: max_votes}
}

const addNextSongToSpotify = (uri, spotify_auth_token, wss, WebSocket, device_id = false) => {

    const config = {
        headers: { Authorization: `Bearer ${spotify_auth_token}` }
    };


    let body
    device_id ? body = {uri, device_id} : body = {uri}

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
        if(err.response.data.error.reason === "NO_ACTIVE_DEVICE"){
            getSpotifyDevices(spotify_auth_token, (device_error, device_result) => {
                if(device_error){
                    return false
                }else{
                    const {devices} = device_result
                    if(devices.length < 1) return false
                    let id
                    let found = false
                    for(let i = 0; i < devices.length; i++){
                        if(devices[i].type === "Smartphone"){
                            id = devices[i].id
                            found = true
                            break
                        }
                    }
                    if(found) return addNextSongToSpotify(uri, spotify_auth_token, wss, WebSocket, id)
                    
                    for(let i = 0; i < devices.length; i++){
                        if(devices[i].type === "Computer"){
                            id = devices[i].id
                            found = true
                            break
                        }
                    }
                    if(found) return addNextSongToSpotify(uri, spotify_auth_token, wss, WebSocket, id)
                    return addNextSongToSpotify(uri, spotify_auth_token, wss, WebSocket, devices[0].id)

                }
            })
        }else{
            return false
        }
        
    })
    
    

    

}



const getSpotifyDevices = (spotify_auth_token, _callback) => {

    const config = {
        headers: { Authorization: `Bearer ${spotify_auth_token}` }
    };

    axios.get("https://api.spotify.com/v1/me/player/devices", config).then(res => {
    
        console.log(res.data)
        _callback(false, res.data)

    }).catch(err => {
        console.log("ERR1")
        console.log(err)
        if(err.response){
            _callback(err.response.status, undefined)
        }else{
            _callback(true, undefined)
        }
    })



}


module.exports = {
    calcNextSong,
    addNextSongToSpotify,
    getSpotifyDevices
}