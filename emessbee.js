var emessbee = {
    state: {
        privkeys: [],
        utxos: [],
    },
    network: "testnet", //regtest, mainnet
    mempoolnet: "mempool.space", //mutinynet.com
    genKeypair: () => {
        var privkey = nobleSecp256k1.utils.randomPrivateKey();
        var pubkey = nobleSecp256k1.getPublicKey( privkey, true );
        return [ emessbee.bytesToHex( privkey ), emessbee.bytesToHex( pubkey ).substring( 2 ) ];
    },
    hexToBytes: hex => Uint8Array.from( hex.match( /.{1,2}/g ).map( byte => parseInt( byte, 16 ) ) ),
    bytesToHex: bytes => bytes.reduce( ( str, byte ) => str + byte.toString( 16 ).padStart( 2, "0" ), "" ),
    sha256: async text_or_bytes => {if ( typeof text_or_bytes === "string" ) text_or_bytes = ( new TextEncoder().encode( text_or_bytes ) );return emessbee.bytesToHex( await nobleSecp256k1.utils.sha256( text_or_bytes ) )},
    waitSomeSeconds: num => {
        var num = num.toString() + "000";
        num = Number( num );
        return new Promise( resolve => setTimeout( resolve, num ) );
    },
    isValidAddress: address => {
        try {
            return !!tapscript.Address.decode( address ).script;
        } catch( e ) {return;}
        return;
    },
    getVin: ( txid, vout, amnt, addy ) => ({
        txid,
        vout,
        prevout: {
            value: amnt,
            scriptPubKey: tapscript.Address.toScriptPubKey( addy ),
        },
    }),
    getVout: ( amnt, addy ) => ({
        value: amnt,
        scriptPubKey: tapscript.Address.toScriptPubKey( addy ),
    }),
    getEvents: async ( relay, kinds, until, since, limit, etags, ptags ) => {
        var socket = new WebSocket( relay );
        var events = [];
        socket.addEventListener( 'message', async function( message ) {
            var [ type, subId, event ] = JSON.parse( message.data );
            var { kind, content } = event || {}
            if ( !event || event === true ) return;
            events.push( event );
        });
        socket.addEventListener( 'open', async function( e ) {
            var subId   = emessbee.bytesToHex( nobleSecp256k1.utils.randomPrivateKey() ).substring( 0, 16 );
            var filter  = {}
            if ( kinds ) filter.kinds = kinds;
            if ( until ) filter.until = until;
            if ( since ) filter.since = since;
            if ( limit ) filter.limit = limit;
            if ( etags ) filter[ "#e" ] = etags;
            if ( ptags ) filter[ "#p" ] = ptags;
            var subscription = [ "REQ", subId, filter ];
            socket.send( JSON.stringify( subscription ) );
        });
        var loop = async () => {
            var len = events.length;
            await emessbee.waitSomeSeconds( 1 );
            if ( len !== events.length ) return await loop();
            socket.close();
            return events;
        }
        return await loop();
    },
    getEvent: async ( relay, id ) => {
        var socket = new WebSocket( relay );
        var returnable;
        socket.addEventListener( 'message', async function( message ) {
            var [ type, subId, event ] = JSON.parse( message.data );
            var { kind, content } = event || {}
            if ( !event || event === true ) return;
            returnable = event;
        });
        socket.addEventListener( 'open', async function( e ) {
            var subId   = emessbee.bytesToHex( nobleSecp256k1.utils.randomPrivateKey() ).substring( 0, 16 );
            var filter  = {limit: 1}
            filter.ids = [ id ];
            var subscription = [ "REQ", subId, filter ];
            socket.send( JSON.stringify( subscription ) );
        });
        var loop = async () => {
            var len = events.length;
            await emessbee.waitSomeSeconds( 1 );
            if ( !returnable ) return await loop();
            socket.close();
            return returnable;
        }
        return await loop();
    },
    prepEvent: async ( privkey, msg, kind, tags ) => {
        pubkey = nobleSecp256k1.getPublicKey( privkey, true ).substring( 2 );
        if ( !tags ) tags = [];
        var event = {
            "content": msg,
            "created_at": Math.floor( Date.now() / 1000 ),
            "kind": kind,
            "tags": tags,
            "pubkey": pubkey,
        }
        var signedEvent = await emessbee.getSignedEvent( event, privkey );
        return signedEvent;
    },
    sendEvent: ( event, relay ) => {
        var socket = new WebSocket( relay );
        socket.addEventListener( 'open', async () => {
            socket.send( JSON.stringify( [ "EVENT", event ] ) );
            setTimeout( () => {socket.close();}, 1000 );
        });
        return event.id;
    },
    getSignedEvent: async ( event, privkey ) => {
        var eventData = JSON.stringify([
            0,
            event['pubkey'],
            event['created_at'],
            event['kind'],
            event['tags'],
            event['content'],
        ]);
        event.id = await emessbee.sha256( eventData );
        event.sig = await nobleSecp256k1.schnorr.sign( event.id, privkey );
        return event;
    },
    getUtxos: ( utxo_set, amount, for_coinjoin = true, num_of_tries = 0 ) => {
        var set_to_return = [];
        var sum_so_far = 0;
        var new_utxo_set = JSON.parse( JSON.stringify( utxo_set ) );
        var loop = () => {
            var rand = Math.floor( Math.random() * new_utxo_set.length );
            set_to_return.push( new_utxo_set[ rand ] );
            sum_so_far = sum_so_far + new_utxo_set[ rand ][ "amnt" ];
            new_utxo_set.splice( rand, 1 );
            if ( sum_so_far < amount + 330 ) loop();
        }
        loop();
        if ( num_of_tries > 10_000 ) {
            alert( "error, you could not fund this transaction. Consolidate your utxos or top up your wallet" );
            return;
        }
        var set_has_toxins;
        var set_has_clean;
        set_to_return.forEach( item => {
            if ( !( "toxic" in item ) ) set_has_clean = true;
            if ( "toxic" in item ) set_has_toxins = true;
        });
        if ( set_has_toxins && set_has_clean ) return emessbee.getUtxos( utxo_set, amount, for_coinjoin, num_of_tries + 1 );
        if ( for_coinjoin && set_to_return.length > 2 ) return emessbee.getUtxos( utxo_set, amount, for_coinjoin, num_of_tries + 1 );
        return set_to_return;
    },
    getBalance: utxo_set => {
        var sum = 0;
        utxo_set.forEach( item => {if ( !( "toxic" in item ) ) sum = sum + item[ "amnt" ]});
        return sum;
    },
    getToxicBalance: utxo_set => {
        var sum = 0;
        utxo_set.forEach( item => {if ( "toxic" in item ) sum = sum + item[ "amnt" ]});
        return sum;
    },
    getThreeFeeRates: async () => {
        var fees = await emessbee.getData( `https://mutinynet.com/api/v1/fees/recommended` );
        fees = JSON.parse( fees );
        var array = [ fees[ "minimumFee" ], fees[ "hourFee" ], fees[ "fastestFee" ] ];
        return array;
    },
    getData: url => {
        return new Promise( async function( resolve, reject ) {
            function inner_get( url ) {
                var xhttp = new XMLHttpRequest();
                xhttp.open( "GET", url, true );
                xhttp.send();
                return xhttp;
            }
            var data = inner_get( url );
            data.onerror = function( e ) {
                resolve( "error" );
            }
            async function isResponseReady() {
                return new Promise( function( resolve2, reject ) {
                    if ( !data.responseText || data.readyState != 4 ) {
                        setTimeout( async function() {
                            var msg = await isResponseReady();
                            resolve2( msg );
                        }, 1 );
                    } else {
                        resolve2( data.responseText );
                    }
                });
            }
            var returnable = await isResponseReady();
            resolve( returnable );
        });
    },
    createQR: content => {
        var dataUriPngImage = document.createElement( "img" ),
        s = QRCode.generatePNG( content, {
            ecclevel: "M",
            format: "html",
            fillcolor: "#FFFFFF",
            textcolor: "#000000",
            margin: 4,
            modulesize: 8,
        });
        dataUriPngImage.src = s;
        dataUriPngImage.className = "qr_code";
        dataUriPngImage.style.width = "100%";
        return dataUriPngImage;
    },
    getBlockheight: async network => {
        var data = await emessbee.getData( `https://${emessbee.mempoolnet}/${network}api/blocks/tip/height` );
        return Number( data );
    },
    findLastModulatedBlockhash: async ( modulo, blockheight = null ) => {
        if ( !blockheight ) blockheight = await emessbee.getBlockheight( '' );
        var blockhash = await emessbee.getData( `https://${emessbee.mempoolnet}/api/block-height/${blockheight}` );
        var int = Number( BigInt( '0x' + blockhash ) % BigInt( modulo ) );
        if ( !int ) return blockhash;
        blockhash = await emessbee.findLastModulatedBlockhash( modulo, blockheight - 1 );
        return blockhash;
    },
    waitForNextDesiredBlock: async ( modulo, last_one ) => {
        if ( !last_one ) last_one = await emessbee.findLastModulatedBlockhash( modulo );
        await emessbee.waitSomeSeconds( 10 );
        var current_one = await emessbee.findLastModulatedBlockhash( modulo );
        if ( current_one === last_one ) return await emessbee.waitForNextDesiredBlock( modulo, last_one );
        return "it's here";
    },
}
