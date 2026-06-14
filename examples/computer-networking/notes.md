# Notes: computer-networking

## TCP vs UDP

Analogy that stuck: TCP is a phone call — you both confirm you're connected, you
notice if the line drops, words arrive in order. UDP is shouting across a room —
fast, no setup, no guarantee anyone heard or in what order. **Why it exists:**
ordering + retransmission cost time; for video/games, a dropped frame is better
than a late one, so UDP trades reliability for latency.

## DNS resolution (the "why")

A name like `example.com` means nothing to the network — routing needs an IP.
DNS is the lookup that turns one into the other, cached at every level (browser →
OS → resolver → root → TLD → authoritative) so the slow full walk happens rarely.

## Open question to chase

Where exactly does the TCP handshake sit relative to the DNS lookup when I open a
URL? (resolve name → *then* handshake to that IP.)
