import unittest
import numpy as np
from run import metrics, normalize, distance, order_quad, warp, transform_lines, groups, text, select_target

def line(s,b):
 x,y,w,h=b
 return dict(text=s,box=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],confidence=.9)

class ExperimentTests(unittest.TestCase):
 def test_metrics_penalize_insertions_and_repetition(self):
  m=metrics('one two','one two two furniture')
  self.assertEqual(m['target_token_recall'],1)
  self.assertEqual(m['token_precision'],.5)
  self.assertEqual(m['wer'],1)
 def test_normalization_preserves_visible_truncation_words(self):
  self.assertEqual(normalize('President Dea... View more'),'president dea view more')
  self.assertGreater(metrics('Dea View more','Dead')['wer'],0)
 def test_geometry_round_trip(self):
  im=np.zeros((120,200,3),np.uint8)
  crop,m=warp(im,[[20,20],[180,30],[175,100],[25,95]])
  before=[line('a',(30,35,60,10))]
  after=transform_lines(transform_lines(before,m),np.linalg.inv(m))
  np.testing.assert_allclose(before[0]['box'],after[0]['box'],atol=.001)
 def test_group_columns_remain_separate(self):
  ls=[line('First title line',(10,10,100,20)),line('Second title line',(10,35,100,20)),line('Other column',(200,10,100,20))]
  self.assertEqual(sorted(map(len,groups(ls))),[1,2])
 def test_heading_does_not_absorb_smaller_subtitle(self):
  ls=[line('A long article headline begins here',(10,100,400,30)),line('and continues here',(10,140,300,28)),line('A smaller summary is separate',(10,190,400,18))]
  self.assertEqual(sorted(map(len,groups(ls))),[1,2])
 def test_blue_video_rectangle_is_not_text_selection(self):
  im=np.zeros((500,800,3),np.uint8);im[100:300,200:600]=[220,90,0]
  ls=[line('A video subtitle',(220,240,220,18)),line('and a caption',(220,265,180,18))]
  self.assertNotEqual(select_target(im,ls)['kind'],'highlight')
 def test_explicit_text_highlight_wins(self):
  im=np.zeros((300,600,3),np.uint8);im[100:160,50:500]=[220,90,0]
  ls=[line('First selected sentence',(60,105,350,18)),line('Second selected sentence',(60,135,350,18))]
  s=select_target(im,ls);self.assertEqual((s['kind'],s['status']),('highlight','selected'))
 def test_red_card_is_ambiguous(self):
  im=np.zeros((800,1000,3),np.uint8);im[300:450,200:650]=[0,0,220]
  ls=[line('A prominent breaking headline',(220,330,400,25)),line('continues on another line',(220,370,350,25))]
  self.assertEqual(select_target(im,ls)['status'],'ambiguous')
 def test_collapsed_post_abstains_and_preserves_visible_text(self):
  ls=[line('Post',(400,200,50,20)),line('@author',(400,240,90,20)),line('Big News',(360,275,100,20)),line('Confirmed By Government',(360,315,200,20)),line('President is official Dea... View more',(360,355,320,20)),line('Relevant people',(800,220,150,20)),line('Rest',(500,450,120,70))]
  s=select_target(np.zeros((800,1000,3),np.uint8),ls)
  self.assertEqual((s['kind'],s['status']),('post','truncated'))
  self.assertIn('Dea...',text(s['lines']));self.assertNotIn('Rest',text(s['lines']))
 def test_empty_selector_abstains(self):
  self.assertEqual(select_target(np.zeros((100,100,3),np.uint8),[])['status'],'no_target')

if __name__=='__main__':unittest.main()
