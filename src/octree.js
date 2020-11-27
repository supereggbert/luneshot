import { 
    Box3,
    Vector3,
    Plane,
    Line3
} from './three.js';

var dummyVec = new Vector3();
var dummyVec2 = new Vector3();
var plane = new Plane();
var line = new Line3();
var vector = new Vector3();
var intersect = new Vector3();

export default class Octree {
  constructor(box) {
    this.triangles = [];
    this.box = box;
    this.subTrees = [];
  }
  addTriangle(tri) {
    if(!this.bounds) this.bounds = new Box3();
    this.bounds.min.x = Math.min(this.bounds.min.x, tri.a.x, tri.b.x, tri.c.x);
    this.bounds.min.y = Math.min(this.bounds.min.y, tri.a.y, tri.b.y, tri.c.y);
    this.bounds.min.z = Math.min(this.bounds.min.z, tri.a.z, tri.b.z, tri.c.z);
    this.bounds.max.x = Math.max(this.bounds.max.x, tri.a.x, tri.b.x, tri.c.x);
    this.bounds.max.y = Math.max(this.bounds.max.y, tri.a.y, tri.b.y, tri.c.y);
    this.bounds.max.z = Math.max(this.bounds.max.z, tri.a.z, tri.b.z, tri.c.z);
    this.triangles.push(tri);
  }
  calcBox() {
    this.box = this.bounds.clone();
    //offset to account for regular grid
    this.box.min.x-=0.1;
    this.box.min.y-=0.1;
    this.box.min.z-=0.1;
  }
  split(level) {
    if (!this.box) return;
    var subTrees = [],
      halfsize = dummyVec2.copy(this.box.max).sub(this.box.min).multiplyScalar(0.5),
      box, v, tri;
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          box = new Box3;
          v = dummyVec.set(x, y, z);
          box.min.copy(this.box.min).add(v.multiply(halfsize))
          box.max.copy(box.min).add(halfsize);
          subTrees.push(new Octree(box));
        }
      }
    }
    while (tri = this.triangles.pop()) {
      for (let i = 0; i < subTrees.length; i++) {
        if (subTrees[i].box.intersectsTriangle(tri)) {
          subTrees[i].triangles.push(tri);
        }
      }
    }
    for (let i = 0; i < subTrees.length; i++) {
      var len = subTrees[i].triangles.length;
      if (len > 8 && level < 16) {
        subTrees[i].split(level + 1);
      }
      if (len != 0) {
        this.subTrees.push(subTrees[i]);
      }
    }
  }
  build() {
    this.calcBox();
    this.split(0);
  }
  getRayTris(ray, triangles) {
    for (let i = 0; i < this.subTrees.length; i++) {
      var subTree = this.subTrees[i];
      if (!ray.intersectBox(subTree.box, intersect)) continue;
      
      if (subTree.triangles.length > 0) {
        for (let j = 0; j < subTree.triangles.length; j++) {
          if (triangles.indexOf(subTree.triangles[j]) == -1) triangles.push(subTree.triangles[j])
        }
      } else {
        subTree.getRayTris(ray, triangles);
      }
    }
  }
  triSphereIntersect(sphere,tri){ // this is too basic needs to be better
    tri.getPlane(plane);
    if(!sphere.intersectsPlane(plane)) return false;

    if(tri.containsPoint(sphere.center)){
        return {normal:plane.normal.clone(),point:plane.projectPoint(sphere.center,new Vector3), depth: Math.abs(plane.distanceToSphere(sphere)) }
    }
    
    //first line
    var point = plane.projectPoint(sphere.center,new Vector3);
    var depth = Math.abs(plane.distanceToSphere(sphere));
    var smallRadius = Math.sqrt(sphere.radius*sphere.radius - depth*depth);
    line.set(tri.a,tri.b);
    line.closestPointToPoint(point, true, vector);
    var d = vector.distanceTo(sphere.center);
    if(d<smallRadius){
        return {normal:sphere.center.clone().sub(vector).normalize(),point:vector.clone(), depth: sphere.radius-d }
    }

    //second line
    var point = plane.projectPoint(sphere.center,new Vector3);
    var depth = Math.abs(plane.distanceToSphere(sphere));
    var smallRadius = Math.sqrt(sphere.radius*sphere.radius - depth*depth);
    line.set(tri.b,tri.c);
    line.closestPointToPoint(point, true, vector);
    var d = vector.distanceTo(sphere.center);
    if(d<smallRadius){
        return {normal:sphere.center.clone().sub(vector).normalize(),point:vector.clone(), depth: sphere.radius-d }
    }

    //third line
    var point = plane.projectPoint(sphere.center,new Vector3);
    var depth = Math.abs(plane.distanceToSphere(sphere));
    var smallRadius = Math.sqrt(sphere.radius*sphere.radius - depth*depth);
    line.set(tri.c,tri.a);
    line.closestPointToPoint(point, true, vector);
    var d = vector.distanceTo(sphere.center);
    if(d<smallRadius){
        return {normal:sphere.center.clone().sub(vector).normalize(),point:vector.clone(), depth: sphere.radius-d }
    }



    return false;
  }
  getSphereTris(sphere, triangles) {
    for (let i = 0; i < this.subTrees.length; i++) {
      var subTree = this.subTrees[i];
      if (!sphere.intersectsBox(subTree.box, intersect)) continue;
      
      if (subTree.triangles.length > 0) {
        for (let j = 0; j < subTree.triangles.length; j++) {
          if (triangles.indexOf(subTree.triangles[j]) == -1) triangles.push(subTree.triangles[j])
        }
      } else {
        subTree.getSphereTris(sphere, triangles);
      }
    }
  }
  sphereIntersect(sphere){
      var tris=[],results=[], res;
      this.getSphereTris(sphere, tris);
      for(let i =0; i<tris.length;i++){
        if(res=this.triSphereIntersect(sphere,tris[i])){
            results.push(res);
        }
      }
      return results;
  }
  rayIntersect(ray) {
    if (ray.direction.length() == 0) return;
    var tris = [], tri, position,
      distance = 1e100,
      result;
    this.getRayTris(ray, tris);
    for (let i = 0; i < tris.length; i++) {
      result = ray.intersectTriangle(tris[i].a, tris[i].b, tris[i].c, true, intersect);
      if (result) {
          var newdistance = result.sub(ray.origin).length();
          if(distance>newdistance){
                position = result.clone().add(ray.origin);
                distance = newdistance;
                tri = tris[i];
          }
      }
    }
    return distance < 1e100 ? {distance,tri,position} : false;
  }
}
