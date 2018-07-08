//canvas size
var CANVAS_WIDTH, CANVAS_HEIGHT;

//initialize circle
var Circle = function(){
	//center's position
	this._cx = Math.random() * CANVAS_WIDTH;
	this._cy = Math.random() * CANVAS_HEIGHT;
	//radius
	this._r = 30 * Math.random() + 50;
	//velocity
	this._vx = 2 * Math.random() + 1;
	this._vy = 2 * Math.random() + 1;
}

Circle.prototype.draw = function(context){
	context.strokeStyle = "black"; 
	context.beginPath();
	context.arc(this._cx, this._cy, this._r, 0, 2 * Math.PI);
	context.closePath();
	context.stroke();
}

//update circle's position with velocity
Circle.prototype.updatePosition = function(){
	this._cx += this._vx;
	this._cy += this._vy;
	this.detectCollision();
}

//collision detection and set position and velocity
Circle.prototype.detectCollision = function(){
	if(this._cx  - this._r < 0 ){
		this._cx = this._r;
		this._vx = -this._vx;
	}
	else if(this._cx + this._r > CANVAS_WIDTH ){
		this._cx = CANVAS_WIDTH - this._r;
		this._vx = -this._vx;
	}

	if(this._cy  - this._r < 0 ){
		this._cy = this._r;
		this._vy = -this._vy;
	}
	else if(this._cy + this._r > CANVAS_HEIGHT ){
		this._cy = CANVAS_HEIGHT - this._r;
		this._vy = -this._vy;
	}
}

//initialize blobby, blobby is composed with several circles
var Blobby = function(numCircles){
	this._circles = [];
	//step size to sample whole canvas.
	this._sampleStep = 10;
	this._sampleGrid = [];
	this._marchingCubeGrid = [];
	this._configurations = {};

	this.initConfiguration();
	for(var i = 0; i < numCircles; i++){
		this._circles.push(new Circle());
	}
	
}

// init 16 different configurations of a cell's corners 
// each one include the unique corners
// "N" represents north, "S" represents south
// "W" represents west, "E" represents east
Blobby.prototype.initConfiguration = function(){
	this._configurations = {
		0: [],
		1: ["S", "W"], //the corner at south-west is the unique one.
		2: ["S", "E"],
		3: ["W", "E"],
		4: ["N", "E"],
		5: ["S", "W", "N", "E"],
		6: ["N", "S"],
		7: ["N", "W"],
		8: ["N", "W"],
		9: ["N", "S"],
		10:["N", "W", "S", "E"],
		11:["N", "E"],
		12:["W", "E"],
		13:["S", "E"],
		14:["S", "W"],
		15:[]
	};
}

//calculate current position(x, y) with math: 
//f(x, y) = sum(r^2 / ((x - cx)^2 +(y-cy)^2)
//f(x, y) >= 1 means the point(x, y) is inside the blobby.
Blobby.prototype.calculate = function(x, y){
	var sum = 0.0;
	for(var i = 0; i < this._circles.length; i++){
		var c = this._circles[i];
		var dist = (x - c._cx) * (x - c._cx) + (y - c._cy) * (y - c._cy);
		sum += c._r * c._r / dist;
	}
	return sum;
}

//update _sampleGrid's value with f(x, y) equation
Blobby.prototype.updateSampleGrid = function(){
	var rows = Math.ceil(CANVAS_HEIGHT / this._sampleStep);
	var cols = Math.ceil(CANVAS_WIDTH / this._sampleStep);

	var grids = [];

	for(var r = 0; r < rows; r++){
		var y = r * this._sampleStep;
		var row = [];
		for(var c = 0; c < cols; c++){
			var x = c * this._sampleStep;
			row.push(this.calculate(x, y));
		}
		grids.push(row);
	}
	return grids;
}

//update _marchingCubeGrid's value based on 4 corners' f(x, y) value.
Blobby.prototype.updateMarchingSquareGrid = function(grid){
	var new_grid = [];

	for(var i = 0; i < grid.length - 1; i++){
		var row = [];
		for(var j = 0; j < grid[i].length - 1; j++){
			//check 4 corners's f(x, y) value
			//if corner's value is greater than 1, then it is inside the blobby,
			//set true, which is a one-bit 1, otherwise, set to false, which is a one-bit 0;
			var NW = grid[i][j] >= 1.0;
			var NE = grid[i][j + 1] >= 1.0;
			var SE = grid[i + 1][j + 1] >= 1.0;
			var SW = grid[i + 1][j] >= 1.0;

			var value = (SW << 0) + (SE << 1) + (NE << 2) + (NW << 3);
			row.push(value);
		}
		new_grid.push(row);
	}
	return new_grid;
}

//update each circle's position
Blobby.prototype.updatePosition = function(){
	for(var i = 0; i < this._circles.length; i++){
		this._circles[i].updatePosition();
	}
}

Blobby.prototype.updateGrids = function(){
	this.updatePosition();
	this._sampleGrid = this.updateSampleGrid();
	this._marchingCubeGrid = this.updateMarchingSquareGrid(this._sampleGrid);
}

//find the threshold value 1's position between f0 and f1.
//return value is the coefficient for linear interpolation
Blobby.prototype.getLerpCoeff = function(f0, f1){
	// if they are the same, return 0
	if(f0 == f1)
		return 0;
	return (1 - f0) / (f1 - f0);
}

Blobby.prototype.drawLineOnMarchingSquare = function(context, p, q){
	// p[0] is row value, which is the height value, 
	// p[1] is column value, which is the width value.
	var x0 = p[1] * this._sampleStep;
	var y0 = p[0] * this._sampleStep;
	var x1 = q[1] * this._sampleStep;
	var y1 = q[0] * this._sampleStep;

	context.beginPath();
	context.moveTo(x0, y0);
	context.lineTo(x1, y1);
	context.closePath();
	context.stroke();
}

//draw each cell according to its marching square type.
Blobby.prototype.drawMarchingSquares = function(context){
	context.strokeStyle = "black";
	for(var i = 0; i < this._marchingCubeGrid.length - 1; i++){
		for(var j = 0; j < this._marchingCubeGrid[i].length - 1; j++){
			var cell = this._marchingCubeGrid[i][j];
			var config = this._configurations[cell];

			var NW = this._sampleGrid[i][j];
			var NE = this._sampleGrid[i][j + 1];
			var SW = this._sampleGrid[i + 1][j];
			var SE = this._sampleGrid[i + 1][j + 1];

			//calculate the threshold value 1's offset value on north, south, east, west side.
			var offsetN = this.getLerpCoeff(NW, NE);
			var offsetS = this.getLerpCoeff(SW, SE);
			var offsetE = this.getLerpCoeff(NE, SE);
			var offsetW = this.getLerpCoeff(NW, SW);

			//map each side with its corresponding threshold value 1' s positions
			var coords = {
				"N": [i, j + offsetN],
				"S": [i + 1, j + offsetS],
				"E": [i + offsetE, j + 1],
				"W": [i + offsetW, j]
			};
			for(var k = 0; k < config.length; k += 2){
				this.drawLineOnMarchingSquare(context, coords[config[k]], coords[config[k + 1]]);
			}
		}
	}
}

//draw background color
Blobby.prototype.drawBackground = function(context){
	context.fillStyle = "#eeeeee";		
	context.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
}

//draw circles without blobby shape
Blobby.prototype.drawCircles = function(context){
	this.drawBackground(context);
	for(var i = 0; i < this._circles.length; i++){
		this._circles[i].draw(context);
	}
}

//draw blobby with marching square method
Blobby.prototype.drawMarchingSquareMethod = function(context){
	this.drawBackground(context);
	this.updateGrids();
	this.drawMarchingSquares(context);
}

window.onload = function(){	
	var canvas = document.getElementById("canvas");
	var context = canvas.getContext("2d");
	canvas.width = CANVAS_WIDTH = window.innerWidth;
	canvas.height = CANVAS_HEIGHT = window.innerHeight;

	//initialize blobby with 8 circles
	var numCircles = 8;
	var blobby = new Blobby(numCircles);

	animate();
	function animate(){
		//blobby.drawCircles(context);
		blobby.drawMarchingSquareMethod(context);
		requestAnimationFrame(animate);
	}
}


