process.on('message', (data) => {
  console.log(data);
  setTimeout(() => {
    throw new Error('est field');
  }, 5000);
});
