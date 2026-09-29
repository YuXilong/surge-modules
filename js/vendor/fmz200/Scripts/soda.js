let obj = JSON.parse($response.body);
obj.data.objects.forEach(item => {
  item.imageUrl = "https://raw.githubusercontent.com/YuXilong/surge-modules/main/assets/warm_water.png";
});
$done({body: JSON.stringify(obj)});
