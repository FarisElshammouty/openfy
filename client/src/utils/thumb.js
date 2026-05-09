// Rewrite YouTube/ytimg/googleusercontent thumbnail URLs to request larger sizes.
// Returns the original URL if it doesn't match a known pattern.
export function upgradeThumbnail(url, size = 480) {
  if (!url) return url;

  // i.ytimg.com/vi/<id>/<quality>.jpg -> use maxresdefault when asking for big
  const ytimg = url.match(/^(https?:\/\/i\.ytimg\.com\/vi(?:_webp)?\/[^/]+\/)([^.]+)(\.\w+)/);
  if (ytimg) {
    const target = size >= 720 ? 'maxresdefault' : size >= 480 ? 'hqdefault' : size >= 320 ? 'mqdefault' : 'default';
    return ytimg[1] + target + ytimg[3];
  }

  // googleusercontent / yt3 — query params at end like =w120-h120-l90-rj or =s256
  const yt3 = url.match(/^(https?:\/\/(?:yt3|lh3)\.googleusercontent\.com\/[^=]+)=(.+)$/);
  if (yt3) {
    return `${yt3[1]}=w${size}-h${size}-l90-rj`;
  }

  // Piped proxy — the underlying ytimg URL is in the host param
  const piped = url.match(/^(https?:\/\/[^/]+\/[^?]+)\?(.+)$/);
  if (piped && url.includes('proxy') && url.includes('host=')) {
    return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`).replace(/=s\d+/, `=s${size}`);
  }

  return url;
}
