module.exports = (room_id, rooms) => {
  if (!(room_id in rooms)) {
    return;
  }
  delete rooms[room_id];
};
