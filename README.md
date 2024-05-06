# Coinjoin workshop -- also known as Emessbee 🐝
A workshop on constructing coinjoin transactions without a coordinator

# Slideshow
https://tinyurl.com/coinjoin-workshop

# Videos

## Demo video

[![](https://supertestnet.github.io/coinjoin-workshop/emessbee-demo-with-yt-logo.jpg)](https://www.youtube.com/watch?v=Fhp5GUyf0Ek)

## Workshop video (I explain it and build it on video)
[![](https://supertestnet.github.io/coinjoin-workshop/emessbee-explainer-with-yt-logo.jpg)](https://www.youtube.com/watch?v=MT0CfuH7upE)

# The Kickout Protocol (not yet implemented in Emessbee)

## Kicking trolls out of Round 1

Suppose in round 1, 100 people register for a coinjoin. If a troll never enters this round, no harm is done. If a troll sends a registration message for this round, there are three ways he can do it incorrectly: not register a valid change output, not register 1 or 2 valid inputs, or register 1 or 2 valid inputs but without proving ownership (you're supposed to sign a recent blockhash with the inputs' private keys). All of those are publicly detectable by every participant, so everyone simply ignores messages that fail any of these steps, and thus every honest participant continues to round 2 with the same set of other honest people. In other words, trollish "Round 1" messages are discarded by all honest parties, so they have no effect, it is as if the trolls never sent a message and thus never entered Round 1.

## Kicking trolls out of Round 2

Suppose a troll did round 1 correctly and is now in round 2. There are three ways a troll can do round 2 incorrectly: not register a valid "equal amount" output, register "too many" equal amount ouputs, or not provide a valid ring signature proving they were in round 1. All honest parties discard messages that lack valid ring signatures, so that part has no effect, it is as if they never sent the message. To detect a troll who uses either of the other two trollish behaviors (i.e. they register 0 or more than 1 "equal amount" output), all parties sum up the number of equal amount outputs and, if it is not equal to the number of people who were in round 1, they know a troll is among them. Therefore, every honest participant should send a new message to the group that unmasks their ring signature by revealing its private key, thus revealing which of their inputs map to which of their outputs.

It is safe to do this because these outputs are never created, the coinjoin attempt fails and will be restarted shortly, without the troll. It's no problem to reveal the would-be link between an input and an output in a coinjoin that never happens. It is also safe to reveal the private key to a ringsig pubkey, because ringsig pubkeys do not have any money in them, they are only used for messaging other coinjoiners during a round, and it is particularly safe in this case, because this ringsig key is about to be discarded anyway since the coinjoin is about to restart without the troll.

If anyone does not do this, or if their now-mapped signature demonstrates that they submitted multiple outputs, the honest participants have identified a troll and the troll's inputs (they are whichever inputs were in a "round 1" message whose "ringsig pubkey" has not been unmasked as "belonging to" exactly one of the outputs), so they kick that troll's inputs out of the group and restart with the remaining honest people (and with new ring pubkeys -- the users should probably share an ordered list of like a thousand ring pubkeys in round 1 so that they don't have to do a new "round 1" to get everyone's new ring pubkey). Continue this procedure until you enter round 3 or you are the only coinjoiner left, which just means there were no other honest coinjoiners in your group, so try again in the next round.

## Kicking trolls out of Round 3

Suppose a troll did rounds 1 and 2 correctly and is now in round 3. There are two ways a troll can do round 3 incorrectly: not provide valid "btc sigs" for their inputs or not provide a valid ring signature proving they were in round 1. All honest parties discard messages that lack valid ring signatures, so that part has no effect, it is as if they never sent the message. And if any troll did not send valid btc sigs, kick his inputs out of the group and restart with the remaining honest people. Continue this procedure until round 3 is done or you are the only coinjoiner left, which just means there were no other honest coinjoiners in your group, so try again in the next round.

## Conclusion

If any troll goes through rounds 1, 2, and 3 properly, then they were not a troll, they followed the emessbee protocol honestly all the way through, so huzzah! But by the above methods you can kick a "real troll" out of any round (1, 2, or 3) and then redo the coinjoin with the remaining honest participants (but skipping round 1). Please let me know if you see any flaws in this protocol. I hasten to add, I have not implemented this "kickout protocol" yet, so Emessbee is currently flawed: sybils can flood any attempt with fake messages to disrupt it and stop it from happening. But if Emessbee works in the happy path (it does) and if the kickout protocol can "enforce" the happy path, then I think we're in good shape.
