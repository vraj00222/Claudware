/** A faithful (trimmed) slice of a real Printables search page payload — the model records are
 *  embedded as JSON with the contiguous id/name/slug shape the parser keys off. Two models. */
export const PRINTABLES_SAMPLE =
  `<html><script>self.__next_f.push([1,"...` +
  `{"id":"226502","name":"M6 Hex Bolt and Nut","slug":"m6-hex-bolt-and-nut","datePublished":"2020-01-01",` +
  `"image":{"id":"4065660","filePath":"media/prints/226502/images/thumb.jpg","__typename":"PrintImageType"},` +
  `"ratingAvg":4.8,"club":false,"user":{"id":"5","handle":"boltmaker","publicUsername":"BoltMaker","__typename":"UserType"},"__typename":"PrintType"}` +
  `,{"id":"107870","name":"Dual Direction Hex Bolt (Remix)","slug":"dual-direction-hex-bolt-remix","datePublished":"2019-06-01",` +
  `"image":{"id":"7","filePath":"media/prints/107870/images/img.jpg","__typename":"PrintImageType"},` +
  `"ratingAvg":4.2,"user":{"id":"9","publicUsername":"RemixWorks","__typename":"UserType"},"__typename":"PrintType"}` +
  `..."])</script></html>`;
