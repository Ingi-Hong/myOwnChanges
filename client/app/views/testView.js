// require.config gives the path for our chartjs library 
require.config({
  paths: {
    chartjs: "https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min",
  },
});

// Definitions for our libraries we will use. jquery doesn't need a path in require.config because 
// It's library is hosted in a folder called jquery.js - in "client/app/vendor/jquery.js"
define(["jquery", "chartjs"], function ($, chartjs) {

  function testView() {

    //In the next few lines we will: 
    //1. create a <canvas> html element, add it to the DOM. 
    //2. create junk data for our chart 
    //3. use the function "chartjs.Chart()" to finally render our chart 

    //We call document.ready because we need the html to be loaded in before we start to add things to the DOM 
    $(document).ready(function () {

      //This code takes an html element with the id "container" and the adds an html canvas element to it
      $('#container').append('<canvas id="myChart" width="20" height="20"></canvas>');

      //Here is some junk data for our chart, taken from Chart.js documentation 
      const labels = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
      ];
    
      const data = {
        labels: labels,
        datasets: [{
          label: 'My First dataset',
          backgroundColor: 'rgb(255, 99, 132)',
          borderColor: 'rgb(255, 99, 132)',
          data: [0, 10, 5, 2, 20, 30, 45],
        }]
      };
    
      const config = {
        type: 'line',
        data: data,
        options: {}
      };

      //Here is where we finally add the Chart to the myChart Div we appended earlier. 
      //Notice that Chart is a chartjs function, so we need to call it as "chartjs.Chart"
      const myChart = new chartjs.Chart(
        document.getElementById('myChart'),
        config
      );


      var ctx = document.getElementById("myChart").getContext("2d");
      ctx.canvas.width = 300;
      ctx.canvas.height = 100;
    });
  }

  return testView;
});
