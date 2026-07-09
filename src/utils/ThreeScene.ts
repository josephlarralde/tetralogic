import {
  AmbientLight,
  DirectionalLight,
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  TetrahedronGeometry,
  Vector3,
  WebGLRenderer,
  // MeshBasicMaterial,
  // BufferGeometry,
} from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import VersorControl from './SphereModelVersorControl'

// définir des clés comme const nécessite une répétition mais permet de
// conserver l'option de compilation `"erasableSyntaxOnly": true`, ce que ne
// permet pas l'utilisation d'Enums
const formulaKey = {
  ForAllPhi: 'forAllPhi',
  NotForAllPhi: 'notForAllPhi',
  ExistsNotPhi: 'existsNotPhi',
  NotExistsNotPhi: 'notExistsNotPhi'
} as const

type FormulaKey = typeof formulaKey[keyof typeof formulaKey]

class ThreeScene {
  container: HTMLDivElement
  width: number
  height: number
  renderer: WebGLRenderer
  sphere: Mesh
  tetra: Mesh
  formulas: Partial<Record<FormulaKey, Mesh>> = {}
  // ou (plus permissif sur les clés) :
  // formulaMeshes: {
  //   [ key: string]: Mesh|null
  // } = {}
  scene: Scene
  camera: PerspectiveCamera
  versorControl: VersorControl

  constructor($container: HTMLDivElement) {
    this.container = $container
    const { clientWidth: width, clientHeight: height } = this.container
    this.width = width
    this.height = height
    this.renderer = new WebGLRenderer({ antialias: true, stencil: true })
    this.renderer.setSize(width, height)

    const sphereMat = new MeshStandardMaterial({
        color: 'white',
        transparent: true,
        opacity: 0.,
    })
    const sphereGeo =  new SphereGeometry(15, 30)
    this.sphere = new Mesh(sphereGeo, sphereMat)

    const tetraMat = new MeshStandardMaterial({ color: 'white' })
    const tetraGeo = new TetrahedronGeometry(10, 0)
    this.tetra = new Mesh(tetraGeo, tetraMat)

    const tetra2Geo = new BufferGeometry()
    const leftBottomBack   = [-1, -1, -1]
    const rightBottomFront = [1, -1, 1]
    const leftTopFront    = [-1, 1, 1]
    const rightTopBack     = [1, 1, -1]

    const faces = [
      leftBottomBack, leftTopFront, rightTopBack,
      leftBottomBack, rightTopBack, rightBottomFront,
      leftBottomBack, rightBottomFront, leftTopFront,
      leftTopFront, rightBottomFront, rightTopBack
    ]
    .flat()
    .map((v: number) => {
      // on veut diagonale = 10 = côté * sqrt(3)
      // donc côté = 10 / sqrt(3)
      return v * 10 / Math.sqrt(3)
    })

    tetra2Geo.setAttribute('position', new Float32BufferAttribute(faces, 3))
    tetra2Geo.computeVertexNormals()

    // const m = new Matrix4().makeRotationFromEuler(new Euler(Math.PI * 0.25, Math.PI * 0.25, 0, 'XYZ'))
    const m = new Matrix4().makeRotationFromEuler(new Euler(Math.atan2(1, Math.SQRT2), -Math.PI * 0.25, 0, 'XYZ'))
    // this.tetra = new Mesh(tetra2Geo, tetraMat)
    this.tetra.setRotationFromMatrix(m)//new Euler(Math.PI * 0.25, Math.PI * 0.25, 0, 'YXZ')

    // set absolute vertice positions to their current positions
    // and reset matrix
    this.tetra.updateMatrix()
    this.tetra.geometry.applyMatrix4(this.tetra.matrix)
    this.tetra.matrix.identity()
    this.tetra.position.set( 0, 0, 0 );
    this.tetra.rotation.set( 0, 0, 0 );
    this.tetra.scale.set( 1, 1, 1 );

    this.scene = new Scene()

    const dlight = new DirectionalLight(0xffffff, 3)
    dlight.position.set(300, 1000, 100)
    this.scene.add(dlight)
    this.scene.add(new AmbientLight(0xffffff))

    this.sphere.add(this.tetra)
    this.scene.add(this.sphere)

    this.camera = new PerspectiveCamera()
    this.camera.fov = 75
    this.camera.aspect = this.width / this.height
    this.camera.near = 0.1
    this.camera.far = 10000
    this.camera.position.z = 35
    this.camera.updateProjectionMatrix()

    this.versorControl = new VersorControl(
      this.container,
      this.scene,
      this.camera,
      this.sphere
    )

    this.init = this.init.bind(this)
    this.animate = this.animate.bind(this)

    this.container.appendChild(this.renderer.domElement);
  }

  async init() {
    const formulaMat = new MeshStandardMaterial({ color: 'white' })

    const forAllPhiGeo = await new STLLoader().loadAsync('models/forallphi.stl')
    this.formulas['forAllPhi'] = new Mesh(forAllPhiGeo, formulaMat)
    
    const notForAllPhiGeo = await new STLLoader().loadAsync('models/notforallphi.stl')
    this.formulas['notForAllPhi'] = new Mesh(notForAllPhiGeo, formulaMat)
    
    const existsNotPhiGeo = await new STLLoader().loadAsync('models/existsnotphi.stl')
    this.formulas['existsNotPhi'] = new Mesh(existsNotPhiGeo, formulaMat)

    const notExistsNotPhiGeo = await new STLLoader().loadAsync('models/notexistsnotphi.stl')
    this.formulas['notExistsNotPhi'] = new Mesh(notExistsNotPhiGeo, formulaMat)

    const f: FormulaKey[] = ['forAllPhi', 'notForAllPhi', 'existsNotPhi', 'notExistsNotPhi']
    const posAttr = this.tetra.geometry.getAttribute('position')
    const tmp = new Vector3()    
    const vertices: Vector3[] = [];

    for (let i = 0; i < posAttr.count; ++i) {
      tmp.fromBufferAttribute(posAttr, i)
      if (!vertices.some(v => v.distanceTo(tmp) < 1e-4)) vertices.push(tmp.clone());
    }

    for (let i = 0; i < vertices.length; ++i) {
      const v = vertices[i].normalize().multiplyScalar(15)
      this.formulas[f[i]]?.position.copy(v)
    }

    // // todo attach to tetra vertices :
    Object.values(this.formulas).forEach(mesh => {
      const s = 0.3
      mesh.geometry.scale(s, s, s)
      this.tetra.add(mesh)
    })

    this.renderer.render(this.scene, this.camera)
  }

  animate() {
    setTimeout(() => {
      requestAnimationFrame(this.animate)
    }, 1000 / 25)

    // requestAnimationFrame(this.animate);

    // const now = Date.now();
    // const dt = now - this.lastFrameDate || 0;
    // this.lastFrameDate = now;

    // needed for inertia update, otherwise it is only updated via pointer events
    // if (this.localControl) {
    //   this.versorControl.update();
    // } else {
    //   if (this.rotation[1]) {
    //       this.sphere.setRotationFromEuler(this.rotation[0]);
    //       this.rotation[1] = false;
    //   }

    //   if (this.zoom[1]) {
    //       this.camera.zoom = this.zoom[0];
    //       this.camera.updateProjectionMatrix();
    //       this.zoom[1] = false;
    //   }
    // }

    // animate population
    // this.particles.update((now - this.startDate) * .0001);

    let inv: Quaternion = new Quaternion()
    this.tetra.getWorldQuaternion(inv).invert()

    Object.values(this.formulas).forEach(mesh => {
      mesh.quaternion.copy(inv)
    })

    // if using anaglyph (also make sure to use a PerspectiveCamera):
    // this.effect.render(this.scene, this.camera);
    // else :
    this.renderer.render(this.scene, this.camera);
  }
}

export default ThreeScene