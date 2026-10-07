import {
  AmbientLight,
  DirectionalLight,
  // BufferGeometry,
  // Euler,
  // Float32BufferAttribute,
  // Matrix4,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  TetrahedronGeometry,
  Vector3,
  WebGLRenderer,
  OrthographicCamera,
  // type EulerOrder,
  // MeshBasicMaterial,
  // BufferGeometry,
} from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import VersorControl from './SphereModelVersorControl'
import { generateCubeOrientations } from './Orientations'

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
  sceneScale: number
  renderer: WebGLRenderer
  sphere: Mesh
  tetra: Mesh
  ghostTetra: Mesh
  formulas: Partial<Record<FormulaKey, Mesh>> = {}
  // ou (plus permissif sur les clés) :
  // formulaMeshes: {
  //   [ key: string]: Mesh|null
  // } = {}
  scene: Scene
  camera: PerspectiveCamera|OrthographicCamera
  //PerspectiveCamera
  versorControl: VersorControl
  orientations: Quaternion[] = []
  // hysteresis : the ghost appears below snapAngle and only disappears
  // above releaseAngle (must be > snapAngle) to avoid flickering
  snapAngle = MathUtils.degToRad(20)
  releaseAngle = MathUtils.degToRad(28)
  snapTarget: Quaternion|null = null
  isSnapping = false
  snapSpeed = 0.2 // slerp factor per frame

  constructor($container: HTMLDivElement) {
    this.container = $container
    const { clientWidth: width, clientHeight: height } = this.container
    this.width = width
    this.height = height
    this.sceneScale = 9
    this.renderer = new WebGLRenderer({ antialias: true, stencil: true })
    this.renderer.setSize(width, height)
    this.renderer.setTransparentSort( (a,b)=>a.z-b.z );

    const sphereMat = new MeshStandardMaterial({
      color: 'white',
      transparent: true,
      opacity: 0,
    })
    const sphereGeo =  new SphereGeometry(15, 30)
    this.sphere = new Mesh(sphereGeo, sphereMat)
    this.sphere.visible = true

    const tetraMat = new MeshStandardMaterial({
      color: 'white',
      transparent: false,
      opacity: 0.5,
    })

    const ghostTetraMat = new MeshBasicMaterial({
      color: 'white',
      wireframe: true,
      wireframeLinewidth: 10,
    })

    const tetraGeo = new TetrahedronGeometry(10, 0)
    this.tetra = new Mesh(tetraGeo.clone(), tetraMat)
    this.ghostTetra = new Mesh(tetraGeo.clone(), ghostTetraMat)
    // this.ghostTetra.scale.set(1.01,1.01,1.01)

    //--------------------------------------------------------------------------
    // Build your own tetrahedron :

    // const tetra2Geo = new BufferGeometry()
    // const leftBottomBack   = [-1, -1, -1]
    // const rightBottomFront = [1, -1, 1]
    // const leftTopFront    = [-1, 1, 1]
    // const rightTopBack     = [1, 1, -1]

    // const faces = [
    //   leftBottomBack, leftTopFront, rightTopBack,
    //   leftBottomBack, rightTopBack, rightBottomFront,
    //   leftBottomBack, rightBottomFront, leftTopFront,
    //   leftTopFront, rightBottomFront, rightTopBack
    // ]
    // .flat()
    // .map((v: number) => {
    //   // on veut diagonale = 10 = côté * sqrt(3)
    //   // donc côté = 10 / sqrt(3)
    //   return v * 10 / Math.sqrt(3)
    // })

    // tetra2Geo.setAttribute('position', new Float32BufferAttribute(faces, 3))
    // tetra2Geo.computeVertexNormals()

    //--------------------------------------------------------------------------
    // MEMO : to snap relative to this base rotation `m` (instead of the
    // identity pose) later, convert it to a quaternion once and premultiply
    // every generated orientation by it, so that each target becomes
    // "cube rotation applied in world frame to the base pose" :
    //   const qm = new Quaternion().setFromRotationMatrix(m)
    //   this.orientations = generateCubeOrientations().map(o => o.multiply(qm))
    // (use qm.clone().multiply(o) instead if the cube rotations should be
    // expressed in the tetra's local frame). The ghost / snap logic in
    // updateGhost() needs no other change since it only compares quaternions.
    // Also start the sphere from qm if the initial pose should be the base pose.

    // this rotation matrix gets the tetrahedron to point towards the camera
    // const m = new Matrix4().makeRotationFromEuler(
    //   new Euler(Math.atan2(1, Math.SQRT2), -Math.PI * 0.25, 0, 'XYZ')
    // )
    // this.tetra.setRotationFromMatrix(m)

    //--------------------------------------------------------------------------
    // the following code sets absolute vertice positions to their current
    // positions and resets matrix :

    // this.tetra.updateMatrix()
    // this.tetra.geometry.applyMatrix4(this.tetra.matrix)
    // this.tetra.matrix.identity()
    // this.tetra.position.set( 0, 0, 0 );
    // this.tetra.rotation.set( 0, 0, 0 );
    // this.tetra.scale.set( 1, 1, 1 );

    //--------------------------------------------------------------------------
    // Add initial rotation offset along x / y / z axis
    // (better pick one of the 24 orientations and apply it) :

    // const makeQuat = (axis: string, angle: number) => {
    //   const a: EulerOrder = ({x:'XYZ', y:'YXZ', z:'ZXY'}[axis] || 'XYZ') as EulerOrder
    //   const e = new Euler(angle, 0, 0, a)
    //   return new Quaternion().setFromEuler(e)
    // }
    // const qy = makeQuat('y', Math.PI)
    // qy.multiply(this.sphere.quaternion)
    // this.sphere.setRotationFromQuaternion(qy)  
    // const qx = makeQuat('x', Math.PI * 0.5)    
    // qx.multiply(this.sphere.quaternion)
    // this.sphere.setRotationFromQuaternion(qx)

    this.orientations = generateCubeOrientations()
    this.ghostTetra.visible = false

    this.scene = new Scene()

    const dlight = new DirectionalLight(0xffffff, 3)
    dlight.position.set(300, 1000, 100)
    this.scene.add(dlight)
    this.scene.add(new AmbientLight(0xffffff))

    this.sphere.add(this.tetra)
    this.sphere.add(this.ghostTetra)
    this.scene.add(this.sphere)

    this.camera = new OrthographicCamera(this.width / -2, this.width / 2, this.height / 2, this.height / -2)
    // this.camera = new PerspectiveCamera()
    // this.camera.fov = 75
    // this.camera.aspect = this.width / this.height

    const defaultZoom = 2;
    const baseSize = 800; // reference viewport size used for defaultZoom
    const sizeFactor = Math.min(this.width, this.height) / baseSize;
    this.camera.zoom = Math.max(0.5, Math.min(8, defaultZoom * sizeFactor));

    this.camera.near = 0.1
    this.camera.far = 10000
    this.camera.position.z = 480//35
    this.camera.updateProjectionMatrix()

    this.versorControl = new VersorControl(
      this.container,
      this.scene,
      this.camera,
      this.sphere
    )

    // dragging cancels any running snap, releasing starts snapping to the
    // currently previewed orientation (if any)
    this.versorControl.on('start', () => { this.isSnapping = false })
    this.versorControl.on('end', () => {
      this.isSnapping = this.snapTarget !== null
    })

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

    const s = this.sceneScale
    this.scene.scale.set(s, s, s)
    this.renderer.render(this.scene, this.camera)
  }

  // finds the closest of the 24 orientations to the sphere's current
  // quaternion and previews it with the ghost tetra
  updateGhost() {
    const S = this.sphere.quaternion
    let best: Quaternion|null = null
    let bestAngle = Infinity

    for (const T of this.orientations) {
      const a = S.angleTo(T) // handles the q / -q double cover
      if (a < bestAngle) {
        bestAngle = a
        best = T
      }
    }

    if (best !== null && bestAngle < this.snapAngle) {
      this.snapTarget = best
    } else if (
      this.snapTarget !== null &&
      S.angleTo(this.snapTarget) < this.releaseAngle
    ) {
      // hysteresis : keep the current target until we're clearly away from it
    } else {
      this.snapTarget = null
    }

    if (this.snapTarget !== null) {
      // local rotation g such that sphere.quaternion * g = snapTarget (world)
      this.ghostTetra.quaternion.copy(S).invert().multiply(this.snapTarget)
      this.ghostTetra.visible = true
    } else {
      this.ghostTetra.visible = false
    }
  }

  updateSnap() {
    if (!this.isSnapping || this.snapTarget === null) return

    const S = this.sphere.quaternion
    if (S.angleTo(this.snapTarget) < 1e-3) {
      S.copy(this.snapTarget)
      this.isSnapping = false
    } else {
      S.slerp(this.snapTarget, this.snapSpeed)
    }
  }

  animate() {
    setTimeout(() => {
      requestAnimationFrame(this.animate)
    }, 1000 / 25)

    this.updateSnap()
    this.updateGhost()

    let inv: Quaternion = new Quaternion()
    this.tetra.getWorldQuaternion(inv).invert()

    Object.values(this.formulas).forEach(mesh => {
      mesh.quaternion.copy(inv)
    })

    this.renderer.render(this.scene, this.camera);
  }
}

export default ThreeScene