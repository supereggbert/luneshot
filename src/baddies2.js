import { 
    InstancedMesh,
    Matrix4,
    Vector3,
    GLTFLoader,
    InstancedBufferAttribute
} from './three.js';

import baddie2glb from '../res/models/baddie2.glb';

export default class Baddies2{
    constructor(scene, loaded){
        var loader = new GLTFLoader().setPath( './' );
        loader.load( baddie2glb, ( gltf ) => {
            var geometry,material;
            gltf.scene.traverse( ( child ) => {
                if ( child.type=="Mesh" ) {
                    geometry=child.geometry;
                    material=child.material;
                }
            } );
            this.radius=5;
            this.count = 20;
            this.active = 0;
            this.health = 3;
            this.score=200;
            this.firerate = 0.1;
            this.maxSpeed = 50;
            var materialShader;
            material.onBeforeCompile=(shader)=>{
                
                shader.vertexShader = shader.vertexShader.replace("#define STANDARD",`
                #define STANDARD
                uniform float uTime;
                attribute vec2 ints;
                `)
                shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>",`
                

                float ntime = color.g*100.0+uTime+ints.x*100.0;
                float dmag = 1.0-min(1.0,color.r*2.0);
                float ang = ntime*4.0+sin(ntime)*dmag;
                float sa = sin(ang);
                float ca = cos(ang);
                vec2 trans = vec2(transformed.x,transformed.z);
                transformed.x = ca*trans.x+sa*trans.y;
                transformed.z = ca*trans.y-sa*trans.x;
                transformed.y -= abs(sin(2.0*ntime))*length(trans)*dmag;

                #include <project_vertex>
                `)
                shader.vertexShader = shader.vertexShader.replace("#include <color_vertex>","if(color.r>0.0) vColor = vec3( 0.2 ); else vColor = vec3( color.b*0.5 )+vec3(0.5,0.0,0.0);");
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
                var baddie = { position: new Vector3((Math.random()-0.5)*60,500,(Math.random()-0.5)*60), velocity: new Vector3(), active: false, radius: this.radius, health: this.health, maxSpeed: this.maxSpeed, score: this.score}
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
            this.mesh.setMatrixAt(i,matrix);
            ints.array[i*2+1]=this.baddies[i].velocity.length();
        }
        ints.needsUpdate = true;
        this.mesh.instanceMatrix.needsUpdate = true;

    }
}