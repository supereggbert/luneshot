
import { 
    Group,
    Mesh,
    Vector3,
    MeshStandardMaterial,
    ParametricBufferGeometry,
    TextureLoader,
    RepeatWrapping,
    Triangle,
    GLTFLoader,
    AdditiveBlending,
    DRACOLoader
} from './three.js';
import Octree from './octree.js';

import landscapeglb from "../res/models/landscape-small.glb";
import shieldsglb from "../res/models/shields.glb";
import shadowlevel from "../res/textures/shadowlevel.jpg";
import groundjpg from "../res/textures/ground.jpg";
import groundshadowjpg from "../res/textures/groundshadow.jpg";
import maskpng from "../res/textures/mask.png";
import normalspng from "../res/textures/normals.png";

import height2png from "../res/textures/height2.png";




export default class WorldMap{
    constructor(callback){
        this.width=600;
        this.height=600;
        this.depth = 100;
        this.terrain = new Group;
        this.loadEnv(()=>{
            this.loadImage(callback);
        })
    }
    loadEnv(callback){
        var loader = new GLTFLoader().setPath( './' );
        var ddecoder = new DRACOLoader();
        ddecoder.setDecoderPath( './draco/' );
        loader.setDRACOLoader( ddecoder );
        loader.load( landscapeglb, ( gltf ) => {
            
            const textures = new TextureLoader().load( shadowlevel );
            gltf.scene.traverse( ( child ) => {
                if ( child.type=="Mesh" ) {
                    child.receiveShadow = true;
                    child.material.onBeforeCompile=(shader)=>{
                        shader.fragmentShader = shader.fragmentShader.replace("#define STANDARD",`
                        #define STANDARD
                        #define STATIC_SHADOW
                        #define STATIC_SHADOW_UV2
                        `);
                        shader.vertexShader = shader.vertexShader.replace("#define STANDARD",`
                        #define STANDARD
                        #define STATIC_SHADOW
                        #define STATIC_SHADOW_UV2
                        `);
                        shader.uniforms['shadowStaticMap'] = {value: textures};
                    }
                }
            });
            this.terrain.add(gltf.scene);
            callback();
        });
        var loader = new GLTFLoader().setPath( './' );
        loader.load( shieldsglb, ( gltf ) => {
            gltf.scene.traverse( ( child ) => {
                if ( child.type=="Mesh" ) {
                    child.material.blending=AdditiveBlending;
                }
            });
            this.terrain.add(gltf.scene);
        })
    }
    loadImage(callback){
        var img = new Image;
        img.onload=()=>{
            var canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img,0,0);
            this.heightData = ctx.getImageData(0,0,128,128);
            
            const geometry = new ParametricBufferGeometry( (u,v,p )=>{
                p.set((v-0.5)*this.width,this.heightAt(v,u)*this.depth,(u-0.5)*this.height);
            }, 127, 127 );

            const textured = new TextureLoader().load( groundjpg );
            const textures = new TextureLoader().load( groundshadowjpg );
            const texturem = new TextureLoader().load( maskpng );
            const texturen = new TextureLoader().load( normalspng );

            textured.repeat.set(50, 50);
            textured.wrapS = RepeatWrapping;
            textured.wrapT = RepeatWrapping;

            texturem.repeat.set(50, 50);
            texturem.wrapS = RepeatWrapping;
            texturem.wrapT = RepeatWrapping;

            const material = new MeshStandardMaterial( { color: 0x080404,roughness: 0.8/*,map: textured,normalMap: texturen*/} );
            const mesh = new Mesh( geometry, material );

            material.onBeforeCompile=(shader,renderer)=>{
                shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",`
                    vec3 dc2 = texture2D( dmap, mod( vUv*vec2(5.0,5.0),vec2(0.5,0.5) ) ).rgb*0.1;
                    vec3 dc1 = texture2D( dmap, mod(vUv*vec2(15.0,15.0),vec2(0.5,0.5) )+vec2(0.5,0.0) ).rgb*0.1;
                    vec3 dc3 = texture2D( dmap, mod(vUv*vec2(5.0,5.0),vec2(0.5,0.5) )+vec2(0.0,0.5) ).rgb*0.15;
                    float mask1 = texture2D( mask, vUv ).g;
                    float mask2 = texture2D( mask, vUv ).r;
                    vec3 dc = mix(dc2,dc1,mask1);
                    dc = mix(dc3,dc,mask2);
                    diffuseColor.rgb = dc;
                `);
                shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>",`
                    vec3 dn2 = texture2D( nmap, mod( vUv*vec2(5.0,5.0),vec2(0.5,0.5) ) ).rgb;
                    vec3 dn1 = texture2D( nmap, mod(vUv*vec2(15.0,15.0),vec2(0.5,0.5) )+vec2(0.5,0.0) ).rgb;
                    vec3 dn3 = texture2D( nmap, mod(vUv*vec2(5.0,5.0),vec2(0.5,0.5) )+vec2(0.0,0.5) ).rgb;
                    vec3 dn = mix(dn2,dn1,mask1);
                    dn = mix(dn3,dn,mask2) * 2.0 - 1.0;
                    
                    normal = perturbNormal2Arb( -vViewPosition, normal, dn*vec3(20.0) );
                    //diffuseColor.rgb=dn.rgb;
                `);
                
                shader.fragmentShader = shader.fragmentShader.replace("uniform vec3 diffuse;",`
                    uniform vec3 diffuse;
                    uniform sampler2D dmap;
                    uniform sampler2D nmap;
                    uniform sampler2D mask;
                `)

                shader.fragmentShader = shader.fragmentShader.replace("#define STANDARD",`
                #define STANDARD
                #define STATIC_SHADOW
                #define TANGENTSPACE_NORMALMAP
                `);

                shader.vertexUvs = true;
                shader.normalMap = true;
                
                shader.uniforms['dmap'] = {value: textured};
                shader.uniforms['nmap'] = {value: texturen};
                shader.uniforms['mask'] = {value: texturem};
                shader.uniforms['shadowStaticMap'] = {value: textures};
                return shader
            }

            mesh.castShadow = false;
            mesh.receiveShadow = true;
            this.terrain.add(mesh);
            this.octree = this.buildOctree(this.terrain);
            
            this.mesh=this.terrain;
            callback();
        };
        img.src=height2png;
        this.img = img;
    }
    heightAt(x,y){
        var heightData = this.heightData;
        var img = this.img;
        x=x*(img.width-1);
        y=y*(img.height-1);

        var idx1 = (Math.floor(y)*img.width+Math.floor(x))*4;
        var idx2 = (Math.ceil(y)*img.width+Math.floor(x))*4;
        var idx3 = (Math.floor(y)*img.width+Math.ceil(x))*4;
        var idx4 = (Math.ceil(y)*img.width+Math.ceil(x))*4;
        var d1 = heightData.data[idx2]*(y%1) + heightData.data[idx1]*(1-(y%1));
        var d2 = heightData.data[idx4]*(y%1) + heightData.data[idx3]*(1-(y%1));
        var d = d2*(x%1)+d1*(1-(x%1));
        return d/255;
    }
    buildOctree( group ) {
        var start=performance.now();
        var octree = new Octree(),
        positions, normals, transform, normalMatrix, v1, v2, v3;
        group.traverse((obj) => {
        if (obj.type == "Mesh") {
            obj.updateMatrix();
            obj.updateWorldMatrix();
            if (obj.geometry.index) obj.geometry = obj.geometry.toNonIndexed();
            positions = obj.geometry.attributes.position.array;
            transform = obj.matrixWorld;
            for (let i = 0; i < positions.length; i += 9) {
                var v1 = new Vector3(positions[i], positions[i + 1], positions[i + 2]);
                var v2 = new Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
                var v3 = new Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);
                v1.applyMatrix4(transform);
                v2.applyMatrix4(transform);
                v3.applyMatrix4(transform);

                octree.addTriangle(new Triangle(v1, v2, v3));
            }
        }
        });
        octree.build();
        
        return octree;
    }
    heightAtPosition(x,y){
        x = x/this.width+0.5;
        y = y/this.height+0.5;
        return this.heightAt(x,y)*this.depth;
    }
    normalAtPosition(x,y){
        var eps = 0.1;
        var v1 = new Vector3(x-eps,this.heightAtPosition(x-eps,y),y);
        var v2 = new Vector3(x+eps,this.heightAtPosition(x+eps,y),y).sub(v1);
        var v1 = v1.set(x,this.heightAtPosition(x,y-eps),y-eps);
        var v3 = new Vector3(x,this.heightAtPosition(x,y+eps),y+eps).sub(v1);

        v3.cross(v2).normalize();
        return v3;
    }
}