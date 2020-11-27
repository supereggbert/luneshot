import { 
    InstancedMesh,
    Matrix4,
    Vector3,
    GLTFLoader,
    InstancedBufferAttribute
} from './three.js';

import model from '../res/models/squid.glb';

export default class Baddies{
    constructor(scene, loaded){
        var loader = new GLTFLoader().setPath( './' );
    

        loader.load( model, ( gltf ) => {
            var geometry,material;
            gltf.scene.traverse( ( child ) => {
                if ( child.type=="Mesh" ) {
                    geometry=child.geometry;
                    material=child.material;
                }
            } );
            this.radius=3;
            this.health=1;
            this.active = 0;
            this.maxSpeed = 100;
            this.count = 150;
            this.score=100;
            this.firerate = 0.03;
            var materialShader;
            material.onBeforeCompile=(shader)=>{
                
                shader.vertexShader = shader.vertexShader.replace("#define STANDARD",`
                #define STANDARD
                uniform float uTime;
                attribute vec2 ints;
                `)
                shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>",`
                float dismag = (1.0-ints.y/100.0)*5.0+1.0;
                transformed.x+=sin(uTime*(4.0+color.b)+color.r*3.0+color.b*100.0+ints.x*100.0)*color.r*dismag;
                transformed.y+=cos(uTime*(4.5+color.b)+color.r*3.0+color.b*150.0+ints.x*100.0-1.57)*color.r*dismag;
                transformed.z-=(1.0-ints.y/100.0)*5.0*color.r-2.0*color.r;
                #include <project_vertex>
                `)
                shader.vertexShader = shader.vertexShader.replace("#include <color_vertex>","if(color.r>0.0) vColor = vec3( color.r,0.0,0.0 ); else vColor = vec3( 0.8,0.4,0.0 );");
                shader.uniforms['uTime']={value:1};
                materialShader = shader;
            };
            
            this.mesh = new InstancedMesh( geometry, material, this.count );
            this.mesh.onBeforeRender=()=>{
                if(materialShader) materialShader.uniforms['uTime'].value=performance.now()/1000;
            };
            this.baddies = [];
            var ints = [];
            for(var i=0;i<this.count; i++){
                var baddie = { position: new Vector3((Math.random()-0.5)*60,500,(Math.random()-0.5)*60), velocity: new Vector3(), active: false,radius: this.radius, health: this.health, maxSpeed: this.maxSpeed, score: this.score}
                this.baddies.push(baddie);
                ints.push(i,0);
            }
            geometry.setAttribute( 'ints', new InstancedBufferAttribute( new Float32Array( ints ), 2 ) );
            scene.add(this.mesh);
            loaded(this.baddies);
        });
    }
    setActive(active, firerate){
        this.active = active;
        this.firerate = firerate;
    }
    reset(){
        for(var i=0;i<this.count; i++){
            this.baddies[i].position.set((Math.random()-0.5)*60,500,(Math.random()-0.5)*60);
            this.baddies[i].velocity.set(0,0,0);
            this.baddies[i].active=i<this.active;
            this.baddies[i].health=this.health;
            this.baddies[i].maxSpeed=this.maxSpeed;
        }
    }
    update(dt, fired){
        if(!this.mesh) return;

        var matrix = new Matrix4;
        var ints=this.mesh.geometry.attributes.ints;
        for(var i=0;i<this.count; i++){
            if(!this.baddies[i].active){
                this.baddies[i].position.set(0,0,0);
                matrix.set( 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 );
                this.mesh.setMatrixAt(i,matrix);
                continue;
            }

            if(Math.random()<this.firerate*dt/1000){
                fired.push(this.baddies[i].position.clone());
            }

            matrix.makeTranslation(this.baddies[i].position.x,this.baddies[i].position.y,this.baddies[i].position.z);
            matrix.lookAt( new Vector3(), this.baddies[i].velocity, new Vector3(0,1,0) );
            this.mesh.setMatrixAt(i,matrix);
            ints.array[i*2+1]=this.baddies[i].velocity.length();
        }
        ints.needsUpdate = true;
        this.mesh.instanceMatrix.needsUpdate = true;

    }
}