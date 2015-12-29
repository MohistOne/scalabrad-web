import 'd3';

var COLOR_LIST = ['red', 'blue', 'yellow', 'green', 'magenta'];

export interface Plot {
  addData(data: Array<Array<number>>): void
}

@component('labrad-plot1d')
export class Plot1D extends polymer.Base implements Plot {

  @property({type: String, value: ''})
  xLabel: string;

  @property({type: String, value: ''})
  yLabel: string;

  private data: Array<Array<number>> = []
  private lastData: Array<number> = null;

  private numTraces: number = 0;
  private svg: any;
  private chartBody: any;
  private clip: any;
  private width: number;
  private height: number;
  private xAxis: any;
  private yAxis: any;
  private xScale: any;
  private yScale: any;
  private line: any;
  private zoom: any;
  private zoomToRect: boolean = true;
  private limits = {xMin: 0, xMax: 1, yMin: 0, yMax: 1};
  private dataLimits = {xMin: NaN, xMax: NaN, yMin: NaN, yMax: NaN};
  private margin: {top: number; right: number; bottom: number; left: number};

  private plot: any;

  attached() {
    this.$.pan.style.color = '#AAAAAA';
    this.redraw();
    window.addEventListener('resize', (event) => this.redraw());
  }

  @observe('xLabel')
  xLabelChanged(newLabel: string, oldLabel: string) {
    if (this.svg) {
      this.svg.select('#x-label').text(newLabel);
    }
  }

  @observe('yLabel')
  yLabelChanged(newLabel: string, oldLabel: string) {
    if (this.svg) {
      this.svg.select('#y-label').text(newLabel);
    }
  }

  private redraw() {
    var area = this.$.plot,
        rect = area.getBoundingClientRect();
    while (area.firstChild) {
      area.removeChild(area.firstChild);
    }
    this.createPlot(area, Math.max(rect.width, 400), Math.max(rect.height, 400));
    this.plotData(this.data);
  }

  private createPlot(area: HTMLElement, totWidth: number = 1000, totHeight: number = 500): void {
    var p = this;
    p.limits = {xMin: 0, xMax: 100, yMin: 0, yMax: 100};
    p.margin = {top: 50, right: 10, bottom: 50, left: 40};

    var width = totWidth - p.margin.left - p.margin.right;
    var height = totHeight - p.margin.top - p.margin.bottom;

    p.width = width;
    p.height = height;

    p.xScale = d3.scale.linear()
            .domain([p.limits.xMin, p.limits.xMax])
            .range([0, width]);

    p.yScale = d3.scale.linear()
            .domain([p.limits.yMin, p.limits.yMax])
            .range([height, 0]);

    p.xAxis = d3.svg.axis()
            .scale(p.xScale)
            .orient('bottom')
            .tickSize(-height);

    p.yAxis = d3.svg.axis()
            .scale(p.yScale)
            .orient('left')
            .ticks(5)
            .tickSize(-width);

    p.line = d3.svg.line()
            .x((d) => p.xScale(d[0]))
            .y((d) => p.yScale(d[1]));

    p.zoom = d3.behavior.zoom()
            .x(p.xScale)
            .y(p.yScale)
            .on('zoom', () => this.handleZoom());

    // plot area
    p.svg = d3.select(area)
            .append('svg:svg')
            .attr('width', width + p.margin.left + p.margin.right)
            .attr('height', height + p. margin.top + p.margin.bottom)
            .append('g')
            .attr('transform', `translate(${p.margin.left}, ${p.margin.top})`)
            .call(p.zoom)
            .append('g')
            .on('mousedown', () => this.zoomRectangle());

    // background rectangle
    p.svg.append('rect')
            .attr('width', width)
            .attr('height', height);

    // x-axis ticks and label
    p.svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0, ${height})`)
            .call(p.xAxis);
    p.svg.append('text')
            .attr('id', 'x-label')
            .attr('transform', `translate(${width / 2}, ${height + p.margin.bottom - 10})`)
            .style('text-anchor', 'middle')
            .text(this.xLabel);

    // y-axis ticks and label
    p.svg.append('g')
            .attr('class', 'y axis')
            .call(p.yAxis);
    p.svg.append('text')
            .attr('id', 'y-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - p.margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text(this.yLabel);

    // draw the graph object (from http://jsfiddle.net/KSAbK/)
    // This keeps the data from exceeding the limits of the plot
    p.chartBody = p.svg.append('g')
            .attr('clip-path', 'url(#clip)');
    p.clip = p.svg.append('svg:clipPath')
            .attr('id', 'clip')
            .append('svg:rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height);
  }

  addData(data: Array<Array<number>>) {
    if (data.length === 0) return;
    var lastData = this.data.length > 0 ? this.data[this.data.length - 1] : null;
    for (let row of data) {
      this.splice('data', this.data.length, 0, row);
    }
    this.plotData(data, lastData);
  }

  private plotData(data: Array<Array<number>>, lastData?: Array<number>) {
    if (data.length === 0) return;
    this.numTraces = data[0].length - 1;
    for (var i = 0; i < this.numTraces; i++) {
      // extract data for trace i, starting with the last datapoint to avoid gaps
      var traceData = [];
      if (lastData) {
        traceData.push([lastData[0], lastData[i+1]]);
      }
      for (let row of data) {
        traceData.push([row[0], row[i+1]]);
      }

      // add this trace to the plot
      if (traceData.length > 1) {
        this.chartBody.append('svg:path')
                .datum(traceData)
                .attr('stroke', COLOR_LIST[i % COLOR_LIST.length])
                .attr('fill', 'none')
                .attr('class', `line${i}`)
                .attr('d', this.line);
      }
    }

    // update the last data point we've seen
    this.lastData = data[data.length - 1];

    // fit to the data (TODO: only if the zoom has not changed)
    for (let row of data) {
      let x = row[0];
      this.dataLimits.xMin = this.safeMin(this.dataLimits.xMin, x);
      this.dataLimits.xMax = this.safeMax(this.dataLimits.xMax, x);
      for (let i = 0; i < this.numTraces; i++) {
        let y = row[i+1];
        this.dataLimits.yMin = this.safeMin(this.dataLimits.yMin, y);
        this.dataLimits.yMax = this.safeMax(this.dataLimits.yMax, y);
      }
    }

    // calculate view limits
    this.limits.xMin = isNaN(this.dataLimits.xMin) ? 0 : this.dataLimits.xMin;
    this.limits.xMax = isNaN(this.dataLimits.xMax) ? 0 : this.dataLimits.xMax;
    this.limits.yMin = isNaN(this.dataLimits.yMin) ? 0 : this.dataLimits.yMin;
    this.limits.yMax = isNaN(this.dataLimits.yMax) ? 0 : this.dataLimits.yMax;

    // if min and max limits are the same (e.g. because we have just one
    // datapoint so far), then offset the limits by a small amount.
    if (this.limits.xMin === this.limits.xMax) {
      this.limits.xMin -= 1;
      this.limits.xMax += 1;
    }
    if (this.limits.yMin === this.limits.yMax) {
      this.limits.yMin -= 1;
      this.limits.yMax += 1;
    }

    // fit to the data (TODO: only if user has not zoomed or panned somewhere else)
    this.reset();
  }

  private safeMin(a: number, b: number): number {
    if (isNaN(a)) return b;
    if (isNaN(b)) return a;
    return Math.min(a, b);
  }

  private safeMax(a: number, b: number): number {
    if (isNaN(a)) return b;
    if (isNaN(b)) return a;
    return Math.max(a, b);
  }

  private handleZoom(force: boolean = false) {
    if (this.zoomToRect && !force) return;
    var svg = this.svg,
        xAxis = this.xAxis,
        yAxis = this.yAxis;

    // zoom and pan axes
    svg.select('.x.axis').call(xAxis);
    svg.select('.y.axis').call(yAxis);

    // zoom and pan data
    for (var k = 0; k < this.numTraces; k++) {
      svg.selectAll(`.line${k}`)
         .attr('class', `line${k}`)
         .attr('d', this.line);
    }
  }

  // Reset to original windown size after zoom-in
  private reset() {
    this.xScale.domain([this.limits.xMin, this.limits.xMax]);
    this.yScale.domain([this.limits.yMin, this.limits.yMax]);
    this.xAxis.scale(this.xScale);
    this.yAxis.scale(this.yScale);
    this.zoom.x(this.xScale);
    this.zoom.y(this.yScale);
    this.handleZoom(true);
  }

  private panMode() {
    this.zoomToRect = false;
    this.$.pan.style.color = 'black';
    this.$.rect.style.color = '#AAAAAA';
  }

  private rectMode() {
    this.zoomToRect = true;
    this.$.pan.style.color = '#AAAAAA';
    this.$.rect.style.color = 'black';
  }

  // Zoom into a selected rectangular region on the graph
  private zoomRectangle() {
    if (this.zoomToRect) {
      var [originX, originY] = d3.mouse(this),
          rect = this.svg.append('rect')
                         .attr('stroke', 'red')
                         .attr('fill-opacity', 0.5);
      originX -= this.margin.left;
      originY -= this.margin.top;
      d3.select(window)
        .on('mousemove.zoomRect', () => {
          var [x, y] = d3.mouse(this);
          x -= this.margin.left;
          y -= this.margin.top;
          x = Math.max(0, Math.min(this.width, x));
          y = Math.max(0, Math.min(this.height, y));
          rect.attr('x', Math.min(originX, x))
              .attr('y', Math.min(originY, y))
              .attr('width', Math.abs(x - originX))
              .attr('height', Math.abs(y - originY));
        })
        .on('mouseup.zoomRect', () => {
          d3.select(window)
            .on('mousemove.zoomRect', null)
            .on('mouseup.zoomRect', null);
          var [x, y] = d3.mouse(this);
          x = Math.max(0, Math.min(this.width, x));
          y = Math.max(0, Math.min(this.height, y));
          if (x !== originX && y !== originY) {
            // Convert box limits from screen to data coordinates and make sure
            // they are in the right order, regardless of which way the user
            // dragged the box.
            var xScale = this.xScale,
                yScale = this.yScale,
                xMin = Math.min(xScale.invert(originX), xScale.invert(x)),
                xMax = Math.max(xScale.invert(originX), xScale.invert(x)),
                yMin = Math.min(yScale.invert(originY), yScale.invert(y)),
                yMax = Math.max(yScale.invert(originY), yScale.invert(y));
            this.zoom.x(xScale.domain([xMin, xMax]))
                     .y(yScale.domain([yMin, yMax]));
          }
          rect.remove();
          this.handleZoom(true);
        }, true);
      d3.event.preventDefault();
      d3.event.stopPropagation();
    }
  }
}
