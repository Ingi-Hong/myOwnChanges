'use strict';
import { React, Component }  from 'react'; 
import { LineChart, Line } from 'recharts';

const e = React.createElement;
const data = [{name: 'Page A', uv: 400, pv: 2400, amt: 2400}, {name: 'Page B', uv: 300, pv: 2600, amt: 2000}];

const RenderLineChart = (
  <LineChart width={400} height={400} data={data}>
    <Line type="monotone" dataKey="uv" stroke="#8884d8" />
  </LineChart>
); 

class LineChart extends React.Component {
    render(){
        return RenderLineChart;
    }
}


const domContainer = document.querySelector('#line_chart_container');
const root = ReactDOM.createRoot(domContainer);root.render(e(RenderLineChart));