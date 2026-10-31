import importlib.util, math, unittest, xml.etree.ElementTree as ET
from pathlib import Path
spec=importlib.util.spec_from_file_location('inspect_reference',Path(__file__).resolve().parents[1]/'scripts/inspect-pptx-reference.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def xf(extra=''):
    return ET.fromstring(f'<a:xfrm xmlns:a="{m.NS["a"]}" {extra}><a:off x="100" y="200"/><a:ext cx="400" cy="600"/><a:chOff x="10" y="20"/><a:chExt cx="200" cy="300"/></a:xfrm>')
class GeometryTests(unittest.TestCase):
    def test_identity(self):self.assertEqual(m.mul(m.I,m.I),m.I)
    def test_group_scale_origin(self):self.assertEqual(m.point(m.group_matrix(xf()),10,20),(100,200))
    def test_group_scale_extent(self):self.assertEqual(m.point(m.group_matrix(xf()),210,320),(500,800))
    def test_flip(self):
        x,y=m.point(m.group_matrix(xf('flipH="1"')),10,20);self.assertAlmostEqual(x,500);self.assertAlmostEqual(y,200)
    def test_rotation(self):
        x,y=m.point(m.group_matrix(xf('rot="5400000"')),110,170);self.assertAlmostEqual(x,300);self.assertAlmostEqual(y,500)
    def test_nested_scale(self):
        mat=m.mul(m.group_matrix(xf()),m.group_matrix(xf()));x,y=m.point(mat,10,20);self.assertEqual((x,y),(280,560))
    def test_missing_bounds(self):self.assertIsNone(m.bounds(ET.fromstring(f'<a:xfrm xmlns:a="{m.NS["a"]}"/>')))
    def test_bounds(self):
        b=m.bounds(xf());self.assertAlmostEqual(b[0]*m.EMU,100);self.assertAlmostEqual(b[2]*m.EMU,400)
    def test_zero_extent(self):
        e=xf();e.find(m.q('a:chExt')).set('cx','0')
        with self.assertRaises(ValueError):m.group_matrix(e)
if __name__=='__main__':unittest.main()
