const formatDate = (timestamp) => {
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  const formattedDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;

  return formattedDate;
};

const dateConstructor = () => {
  return new Date();
};

module.exports = {
  formatDate,
  dateConstructor,
};
