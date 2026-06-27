/// Short, safe prefix of an ID for display. Never throws on short/null values.
String shortId(String? id, {int length = 8}) {
  if (id == null || id.isEmpty) return '';
  return id.length <= length ? id : id.substring(0, length);
}